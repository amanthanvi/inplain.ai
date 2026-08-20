"""T1 — catalog → fetch → extract → ``documents/<company>/<doc>.txt`` → commit.

The commit *is* the snapshot. There is no database: git is the datastore, so
one changed document is one commit, and the history of a policy is the git
history of its file (SPEC §4).

Conduct, all of it from a verified defect in v0.2.0 (SPEC §8):

* one honest identity, sent to origins and used as the robots product token;
* robots.txt parsed by protego, per origin, re-checked on **every redirect
  hop** — redirects are followed by hand for exactly this reason (AC-6);
* conditional GET, where a 304 keeps the validators we already stored;
* the body is streamed and abandoned the moment it passes the size cap;
* every hop resolves DNS itself, refuses any non-global address, and pins the
  connection to the address it checked;
* a per-host politeness delay.

A document that cannot be fetched lawfully or reliably is reported and
skipped. A partial crawl is a normal outcome; a tracked-and-broken document
is not (SPEC §6).

Run it: ``python -m inplain.crawl [--only SLUG] [--no-commit]``
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import subprocess
import sys
import time
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from urllib.parse import urljoin

import trafilatura

from .net import (
    DEFAULT_TIMEOUT,
    MAX_BYTES,
    USER_AGENT,
    BlockedError,
    FetchError,
    HttpResponse,
    PinnedTransport,
    Transport,
    TransportError,
    default_resolver,
    prepare_target,
)
from .robots import ROBOTS_MAX_BYTES, RobotsCache

log = logging.getLogger("inplain.crawl")

DEFAULT_DELAY = 3.0
MAX_REDIRECTS = 5
REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})
STATE_FILENAME = ".crawlstate.json"
STATE_VERSION = 1
# The catalog was validated at ≥500 extracted characters per document. A
# sudden collapse below that is a broken extraction, not a shrunken policy,
# and committing it would publish a diff that never happened.
MIN_EXTRACTED_CHARS = 500
TEXTUAL_TYPES = ("text/html", "application/xhtml+xml", "text/plain", "application/xml")

REQUEST_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.1",
    "Accept-Language": "en",
}


class Status(StrEnum):
    CHANGED = "changed"
    UNCHANGED = "unchanged"
    NOT_MODIFIED = "not_modified"
    BLOCKED = "blocked"
    FAILED = "failed"


@dataclass(frozen=True)
class Document:
    company: str
    company_name: str
    doc: str
    url: str

    @property
    def relpath(self) -> str:
        return f"documents/{self.company}/{self.doc}.txt"

    def __str__(self) -> str:
        return f"{self.company}/{self.doc}"


@dataclass(frozen=True)
class DocumentOutcome:
    document: Document
    status: Status
    detail: str = ""
    commit: str | None = None

    @property
    def ok(self) -> bool:
        return self.status in (Status.CHANGED, Status.UNCHANGED, Status.NOT_MODIFIED)


@dataclass
class CrawlReport:
    outcomes: list[DocumentOutcome] = field(default_factory=list)
    state_commit: str | None = None

    def counts(self) -> dict[str, int]:
        counts = {status.value: 0 for status in Status}
        for outcome in self.outcomes:
            counts[outcome.status.value] += 1
        return counts

    def of_status(self, *statuses: Status) -> list[DocumentOutcome]:
        return [o for o in self.outcomes if o.status in statuses]

    @property
    def problems(self) -> list[DocumentOutcome]:
        return self.of_status(Status.BLOCKED, Status.FAILED)


# --------------------------------------------------------------------------
# catalog


def load_catalog(path: Path) -> list[Document]:
    """Flatten catalog.json into one Document per (company, docType) pair."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError(f"{path}: expected a list of companies")
    documents: list[Document] = []
    for index, company in enumerate(raw):
        try:
            slug = company["slug"]
            name = company["name"]
            policy_urls = company["policy_urls"]
        except (TypeError, KeyError) as exc:
            raise ValueError(f"{path}: entry {index} is missing {exc}") from exc
        if not policy_urls:
            raise ValueError(f"{path}: {slug} has no policy_urls")
        for doc_type, url in policy_urls.items():
            documents.append(Document(slug, name, doc_type, url))
    return documents


# --------------------------------------------------------------------------
# politeness


class Politeness:
    """A minimum gap between requests to the same host.

    ``sleep`` and ``monotonic`` are injected so tests can run at zero delay
    and still assert that the waiting happened.
    """

    def __init__(
        self,
        delay: float = DEFAULT_DELAY,
        sleep: Callable[[float], None] = time.sleep,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        self.delay = delay
        self._sleep = sleep
        self._monotonic = monotonic
        self._last: dict[str, float] = {}
        self.slept: list[tuple[str, float]] = []

    def wait(self, host: str, minimum: float | None = None) -> None:
        delay = self.delay if minimum is None else max(self.delay, minimum)
        last = self._last.get(host)
        now = self._monotonic()
        if last is not None and delay > 0:
            remaining = delay - (now - last)
            if remaining > 0:
                self.slept.append((host, remaining))
                self._sleep(remaining)
                now = self._monotonic()
        self._last[host] = now


# --------------------------------------------------------------------------
# conditional-GET state


@dataclass
class UrlState:
    etag: str | None = None
    last_modified: str | None = None
    content_sha256: str | None = None
    last_fetched_at: str | None = None
    last_checked_at: str | None = None

    def to_json(self) -> dict[str, str]:
        return {k: v for k, v in self.__dict__.items() if v is not None}


class CrawlState:
    """ETag / Last-Modified per URL, persisted next to the documents.

    Committed, because it is what makes the next crawl cheap and polite for
    the origin, and because anyone auditing the archive should be able to see
    which snapshots were confirmed unchanged by the server itself.
    """

    def __init__(self, path: Path) -> None:
        self.path = path
        self._entries: dict[str, UrlState] = {}
        self.dirty = False
        if path.exists():
            raw = json.loads(path.read_text(encoding="utf-8"))
            for url, entry in (raw.get("urls") or {}).items():
                self._entries[url] = UrlState(
                    etag=entry.get("etag"),
                    last_modified=entry.get("last_modified"),
                    content_sha256=entry.get("content_sha256"),
                    last_fetched_at=entry.get("last_fetched_at"),
                    last_checked_at=entry.get("last_checked_at"),
                )

    def get(self, url: str) -> UrlState:
        return self._entries.get(url, UrlState())

    def conditional_headers(self, url: str) -> dict[str, str]:
        state = self.get(url)
        headers = {}
        if state.etag:
            headers["If-None-Match"] = state.etag
        if state.last_modified:
            headers["If-Modified-Since"] = state.last_modified
        return headers

    def record_response(
        self,
        url: str,
        headers: Mapping[str, str],
        content_sha256: str,
        when: str,
    ) -> None:
        """A full 200. The response's validators replace what we stored."""
        entry = self._entries.setdefault(url, UrlState())
        entry.etag = headers.get("ETag")
        entry.last_modified = headers.get("Last-Modified")
        entry.content_sha256 = content_sha256
        entry.last_fetched_at = when
        entry.last_checked_at = when
        self.dirty = True

    def record_not_modified(
        self, url: str, headers: Mapping[str, str], when: str
    ) -> None:
        """A 304. Validators are *only* overwritten when the 304 supplies them.

        v0.2.0 wrote ``None`` over a stored ETag whenever a 304 omitted the
        header, which threw away the only thing that made the next request
        conditional.
        """
        entry = self._entries.setdefault(url, UrlState())
        etag = headers.get("ETag")
        if etag:
            entry.etag = etag
        last_modified = headers.get("Last-Modified")
        if last_modified:
            entry.last_modified = last_modified
        entry.last_checked_at = when
        self.dirty = True

    def save(self) -> None:
        payload = {
            "version": STATE_VERSION,
            "urls": {
                url: self._entries[url].to_json() for url in sorted(self._entries)
            },
        }
        self.path.parent.mkdir(parents=True, exist_ok=True)
        text = json.dumps(payload, indent=2, sort_keys=True) + "\n"
        self.path.write_text(text, encoding="utf-8", newline="\n")
        self.dirty = False


# --------------------------------------------------------------------------
# git


class GitError(RuntimeError):
    pass


class Git:
    """The datastore. Thin, on purpose: add, commit one path, read HEAD."""

    def __init__(self, root: Path) -> None:
        self.root = Path(root)

    def _run(self, *args: str) -> str:
        result = subprocess.run(
            ["git", "-C", str(self.root), *args],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if result.returncode != 0:
            raise GitError(
                f"git {' '.join(args)} failed ({result.returncode}): "
                f"{result.stderr.strip() or result.stdout.strip()}"
            )
        return result.stdout

    def head(self) -> str:
        return self._run("rev-parse", "HEAD").strip()

    def has_changes(self, relpath: str) -> bool:
        """True when the working tree copy differs from what is committed."""
        return bool(self._run("status", "--porcelain", "--", relpath).strip())

    def commit_path(self, relpath: str, message: str) -> str:
        """Stage and commit exactly one path, and nothing else.

        The pathspec on ``commit`` is what keeps a document commit to a single
        document, so T2 can map a commit to the document it snapshots.
        """
        self._run("add", "--", relpath)
        self._run("commit", "--no-verify", "-m", message, "--", relpath)
        return self.head()


def commit_message(document: Document) -> str:
    return (
        f"crawl: {document.company}/{document.doc}\n"
        "\n"
        f"company: {document.company_name} ({document.company})\n"
        f"doc: {document.doc}\n"
        f"url: {document.url}\n"
    )


# --------------------------------------------------------------------------
# extraction


def extract_text(payload: bytes, url: str) -> str | None:
    """trafilatura, and only trafilatura.

    ``fast=True`` disables trafilatura's own fallback algorithms: one
    extractor means a diff reflects the policy changing, not the extractor
    changing its mind between runs. Bytes go in undecoded so trafilatura does
    the encoding detection.
    """
    return trafilatura.extract(
        payload,
        url=url,
        fast=True,
        include_comments=False,
        include_tables=True,
        output_format="txt",
    )


def normalise(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").strip() + "\n"


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------
# the crawler


class Crawler:
    def __init__(
        self,
        root: Path,
        *,
        catalog_path: Path | None = None,
        documents_dir: Path | None = None,
        transport: Transport | None = None,
        resolver: Callable[[str], list[str]] = default_resolver,
        politeness: Politeness | None = None,
        commit: bool = True,
        timeout: float = DEFAULT_TIMEOUT,
        max_bytes: int = MAX_BYTES,
        git: Git | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.root = Path(root)
        self.catalog_path = Path(catalog_path or self.root / "catalog.json")
        self.documents_dir = Path(documents_dir or self.root / "documents")
        self.transport = transport or PinnedTransport()
        self.resolver = resolver
        self.politeness = politeness or Politeness()
        self.commit = commit
        self.timeout = timeout
        self.max_bytes = max_bytes
        self.git = git or Git(self.root)
        self.clock = clock or (lambda: datetime.now(UTC))
        self.state = CrawlState(self.documents_dir / STATE_FILENAME)
        self.robots = RobotsCache(self._fetch_robots)

    # -- fetching ---------------------------------------------------------

    def _fetch(
        self,
        url: str,
        headers: Mapping[str, str],
        *,
        check_robots: bool = True,
        max_bytes: int | None = None,
    ) -> HttpResponse:
        """Follow redirects by hand, revalidating everything on every hop.

        Auto-following would fetch the redirect target before we could ask
        whether we are allowed to, resolve it behind our address checks, and
        hammer a host we never asked permission from.
        """
        cap = self.max_bytes if max_bytes is None else max_bytes
        current = url
        for _ in range(MAX_REDIRECTS + 1):
            target = prepare_target(current, self.resolver)
            delay: float | None = None
            if check_robots:
                decision = self.robots.check(current)
                if not decision.allowed:
                    raise BlockedError(f"{current}: {decision.reason}")
                delay = self.robots.crawl_delay(current)
            self.politeness.wait(target.host, delay)
            response = self.transport.get(target, headers, self.timeout, cap)
            if response.status in REDIRECT_STATUSES:
                location = response.headers.get("Location")
                if not location:
                    raise TransportError(f"{current}: {response.status} with no Location")
                nxt = urljoin(current, location)
                log.debug("redirect %s -> %s", current, nxt)
                current = nxt
                continue
            return response
        raise TransportError(f"{url}: more than {MAX_REDIRECTS} redirects")

    def _fetch_robots(self, url: str) -> HttpResponse:
        return self._fetch(
            url,
            {**REQUEST_HEADERS, "Accept": "text/plain,*/*;q=0.1"},
            check_robots=False,
            max_bytes=ROBOTS_MAX_BYTES,
        )

    # -- documents --------------------------------------------------------

    def document_path(self, document: Document) -> Path:
        return self.documents_dir / document.company / f"{document.doc}.txt"

    def crawl_document(self, document: Document) -> DocumentOutcome:
        headers = {**REQUEST_HEADERS, **self.state.conditional_headers(document.url)}
        now = self.clock().isoformat().replace("+00:00", "Z")
        try:
            response = self._fetch(document.url, headers)
        except BlockedError as exc:
            log.warning("blocked %s: %s", document, exc)
            return DocumentOutcome(document, Status.BLOCKED, str(exc))
        except FetchError as exc:
            log.warning("failed %s: %s", document, exc)
            return DocumentOutcome(document, Status.FAILED, str(exc))

        if response.status == 304:
            self.state.record_not_modified(document.url, response.headers, now)
            log.info("not modified %s", document)
            return DocumentOutcome(document, Status.NOT_MODIFIED, "304 Not Modified")

        if response.status != 200:
            detail = f"HTTP {response.status}"
            log.warning("failed %s: %s", document, detail)
            return DocumentOutcome(document, Status.FAILED, detail)

        content_type = response.headers.get("Content-Type", "")
        if content_type and not any(t in content_type.lower() for t in TEXTUAL_TYPES):
            detail = f"non-textual Content-Type {content_type!r}"
            log.warning("failed %s: %s", document, detail)
            return DocumentOutcome(document, Status.FAILED, detail)

        extracted = extract_text(response.body, response.url)
        if extracted is None:
            detail = "trafilatura extracted nothing"
            log.warning("failed %s: %s", document, detail)
            return DocumentOutcome(document, Status.FAILED, detail)
        text = normalise(extracted)
        if len(text) < MIN_EXTRACTED_CHARS:
            detail = f"extracted only {len(text)} characters"
            log.warning("failed %s: %s", document, detail)
            return DocumentOutcome(document, Status.FAILED, detail)

        path = self.document_path(document)
        previous = path.read_text(encoding="utf-8") if path.exists() else None
        self.state.record_response(document.url, response.headers, sha256(text), now)

        changed = previous != text
        if changed:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8", newline="\n")
            detail = "new document" if previous is None else "content changed"
        else:
            detail = "identical to the stored snapshot"

        if not self.commit:
            log.info("%s %s", "changed" if changed else "unchanged", document)
            return DocumentOutcome(
                document, Status.CHANGED if changed else Status.UNCHANGED, detail
            )

        relpath = self._relpath(path) or document.relpath
        try:
            # git decides, not our string comparison: this also picks up a
            # snapshot left uncommitted by an interrupted run rather than
            # leaving the archive tracked-and-broken.
            if not self.git.has_changes(relpath):
                log.info("unchanged %s", document)
                return DocumentOutcome(document, Status.UNCHANGED, detail)
            sha = self.git.commit_path(relpath, commit_message(document))
        except GitError as exc:
            log.error("commit failed %s: %s", document, exc)
            return DocumentOutcome(document, Status.FAILED, f"commit failed: {exc}")
        log.info("changed %s (%s) %s", document, detail, sha[:7])
        return DocumentOutcome(document, Status.CHANGED, detail, commit=sha)

    # -- the run ----------------------------------------------------------

    def documents(self, only: Sequence[str] | None = None) -> list[Document]:
        documents = load_catalog(self.catalog_path)
        if not only:
            return documents
        wanted = set(only)
        known = {d.company for d in documents}
        unknown = sorted(wanted - known)
        if unknown:
            raise ValueError(f"no such company slug in catalog: {', '.join(unknown)}")
        return [d for d in documents if d.company in wanted]

    def run(self, only: Sequence[str] | None = None) -> CrawlReport:
        report = CrawlReport()
        for document in self.documents(only):
            report.outcomes.append(self.crawl_document(document))
        if self.state.dirty:
            self.state.save()
            if self.commit and (relpath := self._relpath(self.state.path)):
                # Its own commit: a document commit must contain exactly one
                # document, because T2 derives a change record from it.
                try:
                    if self.git.has_changes(relpath):
                        report.state_commit = self.git.commit_path(
                            relpath, "crawl: update conditional-GET state\n"
                        )
                except GitError as exc:
                    log.error("state commit failed: %s", exc)
        return report

    def _relpath(self, path: Path) -> str | None:
        try:
            return Path(path).resolve().relative_to(self.root.resolve()).as_posix()
        except ValueError:
            return None


# --------------------------------------------------------------------------
# CLI


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m inplain.crawl",
        description="Crawl the catalog into documents/, one commit per change.",
    )
    parser.add_argument("--root", type=Path, default=None, help="repository root")
    parser.add_argument("--catalog", type=Path, default=None, help="catalog.json")
    parser.add_argument("--documents", type=Path, default=None, help="documents/ dir")
    parser.add_argument(
        "--only",
        action="append",
        metavar="SLUG",
        help="crawl one company slug (repeatable)",
    )
    parser.add_argument(
        "--no-commit",
        action="store_true",
        help="write files but make no commits",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY,
        help=f"per-host politeness delay in seconds (default {DEFAULT_DELAY})",
    )
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT)
    parser.add_argument("--max-bytes", type=int, default=MAX_BYTES)
    parser.add_argument(
        "--strict",
        action="store_true",
        help="exit non-zero if any document was blocked or failed",
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser


def _default_root() -> Path:
    return Path(__file__).resolve().parent.parent


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    # Root stays at WARNING so trafilatura's per-paragraph debug chatter does
    # not drown the crawl log; our own logger is the one --verbose opens up.
    logging.basicConfig(
        level=logging.WARNING, format="%(levelname)s %(message)s", stream=sys.stderr
    )
    log.setLevel(logging.DEBUG if args.verbose else logging.INFO)
    root = args.root or _default_root()
    crawler = Crawler(
        root,
        catalog_path=args.catalog,
        documents_dir=args.documents,
        commit=not args.no_commit,
        politeness=Politeness(delay=args.delay),
        timeout=args.timeout,
        max_bytes=args.max_bytes,
    )
    try:
        report = crawler.run(args.only)
    except (ValueError, OSError) as exc:
        print(f"crawl aborted: {exc}", file=sys.stderr)
        return 2

    counts = report.counts()
    print(
        " ".join(f"{name}={counts[name]}" for name in counts),
        f"total={len(report.outcomes)}",
    )
    for outcome in report.problems:
        print(f"{outcome.status.value}: {outcome.document} — {outcome.detail}")
    for outcome in report.of_status(Status.CHANGED):
        sha = (outcome.commit or "")[:7]
        print(f"changed: {outcome.document} {sha}".rstrip())
    if args.strict and report.problems:
        return 1
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
