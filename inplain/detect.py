"""T2 — git history of ``documents/`` → change records in ``changes/``.

Walks every commit that touched ``documents/<company>/<doc>.txt`` and writes
``changes/<id>.json`` (the normative shape lives in ``inplain.schema`` /
``docs/decisions/G1-word-level-highlighting.md``) for each one that does not
have a record yet. **Existence of ``changes/<id>.json`` is the ledger** — the
id is derived from the immutable document commit, so re-running is idempotent
and an interrupted run resumes where it stopped.

Decisions, each traceable to a verified v0.2.0 defect:

* **The diff is computed once.** One ``difflib.SequenceMatcher`` pass over the
  two git blobs feeds the hunks, the materiality counts, AND the similarity
  badge. difflib over blob contents beats shelling to ``git diff`` because its
  output is a data structure, not text to re-parse, and it is deterministic
  across git versions and diff-algorithm settings. v0.2.0 ran SequenceMatcher
  *and* diff_match_patch in one module, then recomputed both in another.
* **Materiality is absolute changed content, never a ratio**
  (:data:`SENTENCE_CHARS`). A 67-character "we now sell your personal
  information" insert into a 65k policy scores ~0.997 whole-document
  similarity; a ratio gate drops exactly the changes that matter most. The
  whole-document ratio is computed from the same single diff and stored ONLY
  as ``materiality.similarity_badge``.
* **Effective-date lines are signal, not noise** (AC-5). They are detected in
  the changed lines, surfaced as ``materiality.effective_date_change``, and an
  effective-date-only change is material. They are never treated as cosmetic.
* **Known-cosmetic suppression** covers copyright lines and page numbers only.
* **Every suppression records its reason**: an immaterial change still gets a
  record, with ``material: false`` and a machine-readable reason. Suppressed
  means unpublished, never unrecorded.
* ``detected_at`` is the document commit's author date — deterministic and
  resume-safe — never the wall clock at detection time.
* A document's FIRST snapshot produces no change record: track-start is not a
  change. It is logged, not silently skipped.

Run it: ``python -m inplain.detect [--root PATH] [--documents PATH]
[--changes PATH] [--limit N] [-v]``
"""

from __future__ import annotations

import argparse
import difflib
import json
import logging
import re
import subprocess
import sys
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from . import schema
from .schema import ChangeRecord, Hunk, Materiality

log = logging.getLogger("inplain.detect")

# Materiality threshold: roughly ONE FULL SENTENCE of added or removed prose,
# measured in normalized characters (whitespace runs collapsed to one space).
# 60 is deliberately under the canonical 67-character "we now sell your
# personal information…" insert (SPEC §7) and around the length of a short but
# complete English sentence; a document-relative ratio is banned as a gate
# because it cannot express "one clause got materially worse".
SENTENCE_CHARS = 60

# Reasons are machine-readable constants; one is ALWAYS recorded (SPEC §7).
REASON_ADDED = "added_prose_exceeds_sentence_threshold"
REASON_REMOVED = "removed_prose_exceeds_sentence_threshold"
REASON_EFFECTIVE_DATE = "effective_date_change"
REASON_BELOW_THRESHOLD = "below_sentence_threshold"
REASON_COSMETIC = "known_cosmetic_only"

# Known-cosmetic patterns: copyright lines and page numbers, and NOTHING that
# could match an effective-date line (v0.2.0 stripped those as noise, which
# made the most legally meaningful line in a policy structurally invisible).
# Deliberately narrow: a cosmetic line the patterns miss just counts as prose,
# which errs toward material — the safe direction.
COSMETIC_PATTERNS = (
    # "© 2026 Example", "(c) 2025", "Copyright © 2024 Acme Inc."
    re.compile(r"^\s*(copyright\s*)?(©|\(c\))\s*(19|20)\d{2}\b", re.IGNORECASE),
    re.compile(r"^\s*copyright\s*(19|20)\d{2}\b", re.IGNORECASE),
    re.compile(r"^\s*page\s+\d+(\s+of\s+\d+)?\s*$", re.IGNORECASE),
    re.compile(r"^\s*-?\s*\d+\s*-?\s*$"),  # a bare page number
)

# Effective-date / last-updated lines. Broad on purpose: a false positive errs
# toward material, which is the safe direction for a trust product. A line
# counts only when a keyword AND a parseable date appear together.
_EFFECTIVE_KEYWORDS = re.compile(
    r"\b(effective(\s+date)?|last\s+(updated|modified|revised)|updated|revised"
    r"|date\s+of\s+last\s+revision)\b",
    re.IGNORECASE,
)
_MONTHS = {
    name: index
    for index, names in enumerate(
        (
            ("january", "jan"),
            ("february", "feb"),
            ("march", "mar"),
            ("april", "apr"),
            ("may",),
            ("june", "jun"),
            ("july", "jul"),
            ("august", "aug"),
            ("september", "sep", "sept"),
            ("october", "oct"),
            ("november", "nov"),
            ("december", "dec"),
        ),
        start=1,
    )
    for name in names
}
_MONTH_ALT = "|".join(sorted(_MONTHS, key=len, reverse=True))
_DATE_PATTERNS = (
    # April 2, 2026 / Apr 2 2026
    re.compile(
        rf"\b({_MONTH_ALT})\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?,?\s+(\d{{4}})\b",
        re.IGNORECASE,
    ),
    # 2 April 2026
    re.compile(
        rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+({_MONTH_ALT})\.?,?\s+(\d{{4}})\b",
        re.IGNORECASE,
    ),
    # 2026-04-02
    re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b"),
)

_DOCUMENT_FILE = re.compile(r"^(?P<company>[a-z0-9-]+)/(?P<doc>[a-z0-9-]+)\.txt$")
_MESSAGE_COMPANY = re.compile(r"^company:\s*(?P<name>.+?)\s*\((?P<slug>[^)]+)\)\s*$", re.M)
_MESSAGE_URL = re.compile(r"^url:\s*(?P<url>\S+)\s*$", re.M)

_WHITESPACE = re.compile(r"\s+")


# --------------------------------------------------------------------------
# line classification


def parse_effective_date(line: str) -> str | None:
    """The first date on the line, normalized to YYYY-MM-DD, or None."""
    for pattern in _DATE_PATTERNS:
        match = pattern.search(line)
        if not match:
            continue
        a, b, c = match.groups()
        try:
            if a.isdigit() and len(a) == 4:
                date = datetime(int(a), int(b), int(c))
            elif a.isdigit():
                date = datetime(int(c), _MONTHS[b.lower().rstrip(".")], int(a))
            else:
                date = datetime(int(c), _MONTHS[a.lower().rstrip(".")], int(b))
        except (KeyError, ValueError):
            continue
        return date.strftime("%Y-%m-%d")
    return None


def is_effective_date_line(line: str) -> bool:
    """Keyword plus a parseable date. Checked BEFORE cosmetic patterns; an
    effective-date line is never cosmetic, whatever else it contains."""
    return bool(_EFFECTIVE_KEYWORDS.search(line)) and parse_effective_date(line) is not None


def is_cosmetic_line(line: str) -> bool:
    if is_effective_date_line(line):
        return False
    return any(pattern.search(line) for pattern in COSMETIC_PATTERNS)


def normalized_chars(lines: Sequence[str]) -> int:
    """Changed content measured in normalized characters: whitespace runs
    collapse to one space so formatting churn cannot buy materiality."""
    return sum(len(_WHITESPACE.sub(" ", line).strip()) for line in lines)


def _first_effective_date(lines: Sequence[str]) -> str | None:
    """The date from the first effective-date line among ``lines``, or None."""
    for line in lines:
        if is_effective_date_line(line):
            return parse_effective_date(line)
    return None


# --------------------------------------------------------------------------
# the diff — computed ONCE; everything below consumes this one result


@dataclass(frozen=True)
class Diff:
    """One SequenceMatcher pass: hunks, changed lines, and the badge."""

    hunks: list[Hunk]
    removed_lines: list[str]
    added_lines: list[str]
    similarity_badge: float


def diff_lines(old_lines: Sequence[str], new_lines: Sequence[str]) -> Diff:
    """difflib.SequenceMatcher over the two snapshots, one pass.

    Each non-equal opcode becomes one hunk with up to MAX_CONTEXT_LINES of
    surrounding context. The similarity badge is character-weighted (matched
    line characters over total characters) so it reflects "how much of the
    document is unchanged" — computed from these same opcodes, and stored for
    display only.
    """
    matcher = difflib.SequenceMatcher(None, list(old_lines), list(new_lines), autojunk=False)
    hunks: list[Hunk] = []
    removed_all: list[str] = []
    added_all: list[str] = []
    equal_chars = 0
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            equal_chars += sum(len(line) + 1 for line in old_lines[i1:i2])
            continue
        removed = list(old_lines[i1:i2])
        added = list(new_lines[j1:j2])
        removed_all.extend(removed)
        added_all.extend(added)
        context = schema.MAX_CONTEXT_LINES
        hunks.append(
            Hunk(
                id=f"h{len(hunks) + 1}",
                old_start=i1 + 1,
                new_start=j1 + 1,
                context_before=list(old_lines[max(0, i1 - context) : i1]),
                removed=removed,
                added=added,
                context_after=list(old_lines[i2 : i2 + context]),
            )
        )
    total_chars = sum(len(line) + 1 for line in old_lines) + sum(
        len(line) + 1 for line in new_lines
    )
    similarity = 1.0 if total_chars == 0 else (2.0 * equal_chars) / total_chars
    return Diff(hunks, removed_all, added_all, round(similarity, 4))


def assess_materiality(diff: Diff) -> Materiality:
    """The gate, in absolute normalized characters of changed prose.

    Known-cosmetic lines are excluded from the gated counts (they are what the
    suppression exists for); effective-date lines are always included and are
    material on their own (AC-5). ``added_chars``/``removed_chars`` record
    exactly what was gated. The document-similarity ratio takes no part in the
    decision — it is stored as a display badge and nothing more.
    """
    removed_prose = [line for line in diff.removed_lines if not is_cosmetic_line(line)]
    added_prose = [line for line in diff.added_lines if not is_cosmetic_line(line)]
    added_chars = normalized_chars(added_prose)
    removed_chars = normalized_chars(removed_prose)

    date_from = _first_effective_date(diff.removed_lines)
    date_to = _first_effective_date(diff.added_lines)
    effective_touched = date_from is not None or date_to is not None
    effective_date_change = (
        {"from": date_from, "to": date_to} if date_from and date_to else None
    )

    if added_chars >= SENTENCE_CHARS:
        material, reason = True, REASON_ADDED
    elif removed_chars >= SENTENCE_CHARS:
        material, reason = True, REASON_REMOVED
    elif effective_touched:
        # An effective-date-only change IS material (AC-5), and the reason
        # records exactly that.
        material, reason = True, REASON_EFFECTIVE_DATE
    elif not added_prose and not removed_prose and (diff.added_lines or diff.removed_lines):
        material, reason = False, REASON_COSMETIC
    else:
        material, reason = False, REASON_BELOW_THRESHOLD

    return Materiality(
        material=material,
        reason=reason,
        added_chars=added_chars,
        removed_chars=removed_chars,
        similarity_badge=diff.similarity_badge,
        effective_date_change=effective_date_change,
    )


# --------------------------------------------------------------------------
# git — read-only access to the datastore


class GitError(RuntimeError):
    pass


class GitReader:
    def __init__(self, root: Path) -> None:
        self.root = Path(root)

    def _run(self, *args: str) -> bytes:
        result = subprocess.run(
            ["git", "-C", str(self.root), "-c", "core.quotepath=false", *args],
            capture_output=True,
        )
        if result.returncode != 0:
            stderr = result.stderr.decode("utf-8", "replace").strip()
            raise GitError(f"git {' '.join(args)} failed ({result.returncode}): {stderr}")
        return result.stdout

    def document_commits(self, docs_relpath: str) -> list[tuple[str, str, str, list[str]]]:
        """(sha, author_date_iso, message, files) for every commit that
        touched ``docs_relpath``, oldest first."""
        out = self._run(
            "log",
            "--reverse",
            "--format=%x1e%H%x1f%aI%x1f%B%x1f",
            "--name-only",
            "--",
            docs_relpath,
        ).decode("utf-8", "replace")
        commits = []
        for chunk in out.split("\x1e"):
            if not chunk.strip():
                continue
            sha, author_date, message, names = chunk.split("\x1f", 3)
            files = [line.strip() for line in names.splitlines() if line.strip()]
            commits.append((sha.strip(), author_date.strip(), message, files))
        return commits

    def parent_sha(self, sha: str) -> str | None:
        """The first parent's full sha, or None for a root commit."""
        try:
            out = self._run("rev-parse", "--verify", "--quiet", f"{sha}^")
        except GitError:
            return None
        return out.decode("ascii", "replace").strip() or None

    def path_exists_at(self, sha: str, relpath: str) -> bool:
        try:
            self._run("cat-file", "-e", f"{sha}:{relpath}")
            return True
        except GitError:
            return False

    def blob_text(self, sha: str, relpath: str) -> str:
        return self._run("show", f"{sha}:{relpath}").decode("utf-8", "replace")


# --------------------------------------------------------------------------
# the detector


@dataclass
class DetectReport:
    created: int = 0  # material records written this run
    suppressed: int = 0  # immaterial records written this run (still recorded)
    skipped: int = 0  # ledger hits, first snapshots, no-op commits
    record_ids: list[str] = field(default_factory=list)


class Detector:
    def __init__(
        self,
        root: Path,
        *,
        documents_dir: Path | None = None,
        changes_dir: Path | None = None,
    ) -> None:
        self.root = Path(root)
        self.documents_dir = Path(documents_dir or self.root / "documents")
        self.changes_dir = Path(changes_dir or self.root / "changes")
        self.git = GitReader(self.root)
        self._catalog: dict[str, dict[str, object]] | None = None

    def _docs_relpath(self) -> str:
        try:
            return (
                self.documents_dir.resolve()
                .relative_to(self.root.resolve())
                .as_posix()
            )
        except ValueError as exc:
            raise GitError(
                f"documents dir {self.documents_dir} is not inside the repository "
                f"root {self.root}"
            ) from exc

    # -- identity fallbacks -------------------------------------------------

    def _catalog_entry(self, company: str) -> dict[str, object]:
        if self._catalog is None:
            self._catalog = {}
            path = self.root / "catalog.json"
            if path.exists():
                try:
                    for entry in json.loads(path.read_text(encoding="utf-8")):
                        self._catalog[entry["slug"]] = entry
                except (ValueError, TypeError, KeyError) as exc:
                    log.warning("could not read catalog.json for names: %s", exc)
        return self._catalog.get(company, {})

    def _identity(self, company: str, doc: str, message: str) -> tuple[str, str]:
        """(company_name, source_url): the T1 commit message is authoritative
        (it is immutable alongside the snapshot); catalog.json is the fallback."""
        name_match = _MESSAGE_COMPANY.search(message)
        url_match = _MESSAGE_URL.search(message)
        name = name_match.group("name") if name_match else None
        url = url_match.group("url") if url_match else None
        if name is None or url is None:
            entry = self._catalog_entry(company)
            if name is None:
                name = str(entry.get("name") or company)
            if url is None:
                urls = entry.get("policy_urls")
                url = str(urls.get(doc, "")) if isinstance(urls, dict) else ""
        return name, url

    # -- one commit ---------------------------------------------------------

    @staticmethod
    def _detected_at(author_date_iso: str) -> str:
        """The commit's author date, in UTC. Deterministic and resume-safe:
        re-running detect later yields byte-identical records."""
        moment = datetime.fromisoformat(author_date_iso).astimezone(UTC)
        return moment.isoformat().replace("+00:00", "Z")

    def detect_one(
        self,
        sha: str,
        author_date_iso: str,
        message: str,
        relpath: str,
        company: str,
        doc: str,
    ) -> ChangeRecord | None:
        """The change record for one (commit, document), or None for a first
        snapshot / no-op. Raises GitError when git itself fails."""
        parent_sha = self.git.parent_sha(sha)
        if parent_sha is None or not self.git.path_exists_at(parent_sha, relpath):
            log.info(
                "track-start %s/%s at %s — first snapshot, not a change; "
                "no record is produced",
                company,
                doc,
                sha[:7],
            )
            return None
        old_text = self.git.blob_text(parent_sha, relpath)
        new_text = self.git.blob_text(sha, relpath)
        if old_text == new_text:
            log.info("no content change for %s/%s at %s", company, doc, sha[:7])
            return None
        diff = diff_lines(old_text.splitlines(), new_text.splitlines())
        if not diff.hunks:
            log.info("empty diff for %s/%s at %s", company, doc, sha[:7])
            return None
        company_name, source_url = self._identity(company, doc, message)
        return ChangeRecord(
            company=company,
            company_name=company_name,
            doc=doc,
            source_url=source_url,
            commit=sha,
            parent_commit=parent_sha,
            detected_at=self._detected_at(author_date_iso),
            materiality=assess_materiality(diff),
            hunks=diff.hunks,
        )

    # -- the run --------------------------------------------------------------

    def run(self, limit: int | None = None) -> DetectReport:
        report = DetectReport()
        docs_relpath = self._docs_relpath()
        prefix = docs_relpath + "/"
        for sha, author_date, message, files in self.git.document_commits(docs_relpath):
            for relpath in files:
                if not relpath.startswith(prefix):
                    continue
                match = _DOCUMENT_FILE.match(relpath[len(prefix) :])
                if not match:
                    continue
                company, doc = match.group("company"), match.group("doc")
                if limit is not None and report.created + report.suppressed >= limit:
                    return report
                rid = schema.record_id(company, doc, sha)
                out_path = self.changes_dir / f"{rid}.json"
                if out_path.exists():
                    # The ledger: this commit's change is already recorded.
                    log.debug("already recorded %s", rid)
                    report.skipped += 1
                    continue
                record = self.detect_one(sha, author_date, message, relpath, company, doc)
                if record is None:
                    report.skipped += 1
                    continue
                payload = record.to_dict()
                schema.dump_record(payload, out_path)
                report.record_ids.append(record.id)
                materiality = record.materiality
                if materiality.material:
                    report.created += 1
                    log.info(
                        "created %s (%s, +%d/-%d chars, %d hunks)",
                        record.id,
                        materiality.reason,
                        materiality.added_chars,
                        materiality.removed_chars,
                        len(record.hunks),
                    )
                else:
                    # Suppressed means unpublished, not unrecorded: the record
                    # exists, carries material:false, and names its reason.
                    report.suppressed += 1
                    log.info(
                        "suppressed %s (%s, +%d/-%d chars) — recorded, unpublished",
                        record.id,
                        materiality.reason,
                        materiality.added_chars,
                        materiality.removed_chars,
                    )
        return report


# --------------------------------------------------------------------------
# CLI


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m inplain.detect",
        description=(
            "Walk the git history of documents/ and write a change record to "
            "changes/<id>.json for every document commit that lacks one. "
            "Idempotent: existing records are the ledger."
        ),
    )
    parser.add_argument("--root", type=Path, default=None, help="repository root")
    parser.add_argument("--documents", type=Path, default=None, help="documents/ dir")
    parser.add_argument("--changes", type=Path, default=None, help="changes/ output dir")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        metavar="N",
        help="write at most N records this run (oldest commits first)",
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser


def _default_root() -> Path:
    return Path(__file__).resolve().parent.parent


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.WARNING, format="%(levelname)s %(message)s", stream=sys.stderr
    )
    log.setLevel(logging.DEBUG if args.verbose else logging.INFO)
    root = args.root or _default_root()
    detector = Detector(
        root, documents_dir=args.documents, changes_dir=args.changes
    )
    try:
        report = detector.run(limit=args.limit)
    except (GitError, schema.SchemaError, OSError, ValueError) as exc:
        print(f"detect aborted: {exc}", file=sys.stderr)
        return 2
    print(
        f"created={report.created} skipped={report.skipped} "
        f"suppressed={report.suppressed}"
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
