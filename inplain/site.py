"""T4 — change records + catalog → the static site in ``_site/`` (AC-7).

Input is ``catalog.json`` and ``changes/*.json`` (validated through
``inplain.schema``); output is a directory of complete static HTML documents
plus the two stylesheets. Nothing under ``documents/`` is ever read: the site
publishes the changed passages, the cited summary, and a link to the source —
never the full document text (SPEC §5).

Load-bearing decisions:

* **All-or-nothing.** Every record in ``changes/`` is validated before a
  single output byte is written; one invalid record aborts the whole build
  (CLI exit 2). A partial site that silently dropped a record would be a
  trust failure, so there is no "skip the bad one" mode.
* **Suppressed records are never published.** ``materiality.material: false``
  means no page, no link, no mention of the id anywhere in the output.
  :func:`load_published_records` is the single filter; T5 (``inplain.feeds``)
  reuses it so the site and the feeds can never disagree about what is
  public.
* **Deterministic output.** Identical inputs rebuild byte-identically: no
  wall clock anywhere (the footer's "latest" date comes from the newest
  change record), records are sorted by (detected_at desc, id asc), and
  companies by slug.
* **Readable with JS disabled — by construction.** No template emits a
  ``<script>``; citation jump-to-hunk is an anchor link (``#h1``) resolved by
  the browser.
* **No dead internal links.** Company pages are generated for the union of
  catalog companies and companies appearing in published records, so every
  internal link the templates can produce has a target; anything else is the
  real ``404.html``.
* The accessibility floor (SPEC §9) lives in the templates: one ``h1`` per
  page, a skip link, landmarks, ``lang``, per-page titles, and a diff that is
  never colour-only (``+``/``−`` gutter marks plus visually-hidden
  "Added:"/"Removed:" labels).
* **Word-level marks are presentation, computed here, never stored** (#38).
  :func:`word_spans` diffs a Hunk's removed text against its added text at
  build time; ``word_spans`` in the record stays ``null``. Citations quote
  and validate against the plain lines on their Side (SPEC §3); marks and the
  cited-quote highlight exist only in the rendered markup.

Run it: ``python -m inplain.site [--root PATH] [--changes PATH]
[--catalog PATH] [--out PATH] [-v]``
"""

from __future__ import annotations

import argparse
import difflib
import json
import logging
import math
import re
import shutil
import sys
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from jinja2 import Environment, FileSystemLoader
from markupsafe import Markup, escape

from . import schema
from .schema import SchemaError

log = logging.getLogger("inplain.site")

# Templates and stylesheets ship with the package's source tree; they are not
# part of the data root, so --root never relocates them.
_REPO = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = _REPO / "templates"
STATIC_DIR = _REPO / "static"
STYLESHEETS = ("tokens.css", "site.css")
# The self-hosted typeface (Literata, SIL OFL 1.1): copied as a directory
# into _site/static/fonts/. No font is ever requested from a third party.
FONTS_DIR = STATIC_DIR / "fonts"

# The date of the catalog's first baseline Snapshots (the first ``crawl:``
# commits under documents/). Every Change record compares against a Snapshot
# from this date or later; nothing earlier is on record. A constant, not a
# clock read or a git call, so rebuilds stay byte-identical.
WATCH_SINCE = "2026-08-20"

# The home feed shows the most recent material changes; the full list lives
# at /changes/ (linked whenever the feed is truncated).
FEED_LIMIT = 30

DOC_TITLES = {
    "privacy": "Privacy Policy",
    "tos": "Terms of Service",
    "terms": "Terms of Service",
    "cookies": "Cookie Policy",
}


def doc_title(doc: str) -> str:
    return DOC_TITLES.get(doc, doc.replace("-", " ").title())


# --------------------------------------------------------------------------
# loading — the seam T5's feeds.py reuses


def load_records(changes_dir: Path) -> list[dict[str, Any]]:
    """Every record in ``changes_dir``, each validated against the normative
    schema. Raises :class:`SchemaError` on the first invalid record — a build
    is all-or-nothing. A missing directory is an empty archive, not an error.
    """
    changes_dir = Path(changes_dir)
    if not changes_dir.is_dir():
        return []
    records: list[dict[str, Any]] = []
    for path in sorted(changes_dir.glob("*.json")):
        try:
            record = schema.load_record(path)
        except SchemaError as exc:
            raise SchemaError(f"{path.name}: {exc}") from exc
        except (OSError, ValueError) as exc:
            raise SchemaError(f"{path.name}: unreadable change record: {exc}") from exc
        if record["id"] != path.stem:
            raise SchemaError(
                f"{path.name}: filename does not match record id {record['id']!r}"
            )
        records.append(record)
    return records


def load_published_records(changes_dir: Path) -> list[dict[str, Any]]:
    """The publishable records, newest first: validated, ``material: true``
    only. Suppressed records never leave this function — the site (T4) and
    the feeds (T5) both publish exactly this list and nothing else.

    Order: ``detected_at`` descending, then id ascending — deterministic for
    byte-identical rebuilds.
    """
    records = [r for r in load_records(changes_dir) if r["materiality"]["material"]]
    records.sort(key=lambda r: r["id"])
    records.sort(key=lambda r: r["detected_at"], reverse=True)
    return records


def load_catalog(catalog_path: Path) -> list[dict[str, Any]]:
    """catalog.json, minimally validated (slug, name, policy_urls)."""
    try:
        entries = json.loads(Path(catalog_path).read_text(encoding="utf-8"))
    except OSError as exc:
        raise ValueError(f"cannot read catalog {catalog_path}: {exc}") from exc
    except ValueError as exc:
        raise ValueError(f"catalog {catalog_path} is not valid JSON: {exc}") from exc
    if not isinstance(entries, list):
        raise ValueError("catalog must be a JSON array of companies")
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise ValueError(f"catalog[{index}]: must be an object")
        for key in ("slug", "name"):
            if not isinstance(entry.get(key), str) or not entry[key]:
                raise ValueError(f"catalog[{index}]: {key} must be a non-empty string")
        if not isinstance(entry.get("policy_urls"), dict):
            raise ValueError(f"catalog[{index}]: policy_urls must be an object")
    return entries


# --------------------------------------------------------------------------
# word-level marks (#38) — build-time presentation, never stored
#
# A token diff (words, single punctuation marks, whitespace runs) of one
# Hunk's removed text against its added text, expressed as character offsets
# into the plain lines in exactly the shape G1 reserved for ``word_spans``:
# ``{"removed": [[line, [[start, end], …]], …], "added": […]}``.

_TOKEN = re.compile(r"\s+|\w+|[^\w\s]")

# Below this token-level similarity the passage was rewritten, not edited:
# marking "changed words" in a rewrite would mark nearly everything and
# point the eye at noise, so the sides render unmarked.
WORD_MARK_MIN_SIMILARITY = 0.5


def _tokens(text: str) -> list[tuple[int, int]]:
    return [(m.start(), m.end()) for m in _TOKEN.finditer(text)]


def _per_line(lines: list[str], spans: list[tuple[int, int]]) -> list[list[Any]]:
    """Map spans over ``"\n".join(lines)`` back to per-line offsets, trimmed
    of surrounding whitespace; whitespace-only pieces are dropped."""
    out: list[list[Any]] = []
    offset = 0
    for index, line in enumerate(lines):
        lo, hi = offset, offset + len(line)
        local = []
        for start, end in spans:
            s2, e2 = max(start, lo), min(end, hi)
            piece = line[s2 - lo : e2 - lo] if s2 < e2 else ""
            if piece.strip():
                lead = len(piece) - len(piece.lstrip())
                trail = len(piece) - len(piece.rstrip())
                local.append([s2 - lo + lead, e2 - lo - trail])
        if local:
            out.append([index, local])
        offset = hi + 1
    return out


def spacing_only(removed: list[str], added: list[str]) -> bool:
    """Both Sides exist and differ only in whitespace or line breaks."""
    return bool(removed and added) and (
        "".join("".join(removed).split()) == "".join("".join(added).split())
    )


def word_spans(removed: list[str], added: list[str]) -> dict[str, Any] | None:
    """G1-shaped word spans for one Hunk, or ``None`` when there is nothing to
    align: a one-sided Hunk, a spacing-only difference, or sides whose token
    similarity is below :data:`WORD_MARK_MIN_SIMILARITY`."""
    if not removed or not added or spacing_only(removed, added):
        return None
    a, b = "\n".join(removed), "\n".join(added)
    ta, tb = _tokens(a), _tokens(b)
    matcher = difflib.SequenceMatcher(
        None, [a[s:e] for s, e in ta], [b[s:e] for s, e in tb], autojunk=False
    )
    if matcher.ratio() < WORD_MARK_MIN_SIMILARITY:
        return None
    rem: list[tuple[int, int]] = []
    add: list[tuple[int, int]] = []
    for op, i1, i2, j1, j2 in matcher.get_opcodes():
        if op in ("replace", "delete") and i1 < i2:
            rem.append((ta[i1][0], ta[i2 - 1][1]))
        if op in ("replace", "insert") and j1 < j2:
            add.append((tb[j1][0], tb[j2 - 1][1]))
    spans = {"removed": _per_line(removed, rem), "added": _per_line(added, add)}
    return spans if spans["removed"] or spans["added"] else None


def _quote_spans(lines: list[str], quote: str) -> list[list[Any]]:
    """Where a Citation's quote sits on its Side, per line — found by the
    same tolerance the validator allows (whitespace runs, then case)."""
    words = quote.split()
    if not words:
        return []
    pattern = r"\s+".join(re.escape(word) for word in words)
    text = "\n".join(lines)
    match = re.search(pattern, text) or re.search(pattern, text, re.IGNORECASE)
    return _per_line(lines, [match.span()]) if match else []


def _mark_line(text: str, spans: list[tuple[int, int, str]]) -> Markup:
    """Escape one plain line and wrap its spans: ``del``/``ins`` for word
    marks, and one ``mark.q`` around each contiguous run of cited quote,
    outermost, so the two cues nest rather than merge. The text itself is
    never altered, only wrapped."""
    cuts = sorted({0, len(text), *(s for s, _, _ in spans), *(e for _, e, _ in spans)})
    out: list[str] = []
    in_quote = False
    for start, end in zip(cuts, cuts[1:]):
        kinds = {k for s, e, k in spans if s <= start and end <= e}
        if ("q" in kinds) != in_quote:
            out.append("</mark>" if in_quote else '<mark class="q">')
            in_quote = not in_quote
        piece = str(escape(text[start:end]))
        for tag in ("del", "ins"):
            if tag in kinds:
                piece = f"<{tag}>{piece}</{tag}>"
        out.append(piece)
    if in_quote:
        out.append("</mark>")
    return Markup("".join(out))


# --------------------------------------------------------------------------
# view models — templates receive plain, pre-formatted data


def _thousands(n: int) -> str:
    return f"{n:,}"


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def _effective_date_text(change: dict[str, str | None] | None) -> str | None:
    if change is None:
        return None
    date_from, date_to = change.get("from"), change.get("to")
    if date_from and date_to:
        return f"Effective date changed: {date_from} → {date_to}"
    if date_to:
        return f"Effective date added: {date_to}"
    return f"Effective date removed (was {date_from})"


def _effective_date_fact(change: dict[str, str | None] | None) -> str | None:
    """The same fact, worded for the ``Effective date`` row of the facts."""
    if change is None:
        return None
    date_from, date_to = change.get("from"), change.get("to")
    if date_from and date_to:
        return f"changed from {date_from} to {date_to}"
    if date_to:
        return f"added: {date_to} (no date stated before)"
    return f"removed (was {date_from})"


def _unchanged_text(similarity: float) -> str:
    """The similarity badge as prose. Rounded DOWN to one decimal so the
    record never overstates how much stayed the same."""
    pct = math.floor(round(similarity * 1000, 6)) / 10
    return f"{pct:g}% of the text unchanged"


_KIND_LABELS = {"replace": "replaced", "insert": "added", "delete": "removed"}


def _hunk_kind(hunk: dict[str, Any]) -> str:
    if hunk["removed"] and hunk["added"]:
        return "replace"
    return "insert" if hunk["added"] else "delete"


# Context lines locate a passage in the document (often a heading); they are
# not evidence and not the publication, so only the line nearest the change
# is shown on each side, clipped at a word boundary (SPEC §5).
CONTEXT_CLIP = 160


def _clip_context(line: str, *, keep: str) -> str:
    if len(line) <= CONTEXT_CLIP:
        return line
    if keep == "head":
        cut = line.rfind(" ", 0, CONTEXT_CLIP)
        return line[: cut if cut > 0 else CONTEXT_CLIP].rstrip() + " …"
    start = line.find(" ", len(line) - CONTEXT_CLIP)
    return "… " + line[start if start >= 0 else len(line) - CONTEXT_CLIP :].lstrip()


def _hunk_view(
    hunk: dict[str, Any],
    number: int,
    total: int,
    quotes: dict[str, list[str]],
) -> dict[str, Any]:
    """One Hunk as the templates render it: each line pre-marked (escaped
    text, word marks, cited-quote highlights) and the neighbouring context
    clipped."""
    marks = word_spans(hunk["removed"], hunk["added"])
    sides: dict[str, list[Markup]] = {}
    for side, tag in (("removed", "del"), ("added", "ins")):
        lines = hunk[side]
        per_line: dict[int, list[tuple[int, int, str]]] = {}
        for index, ranges in (marks or {}).get(side, []):
            per_line.setdefault(index, []).extend((s, e, tag) for s, e in ranges)
        for quote in quotes.get(side, []):
            for index, ranges in _quote_spans(lines, quote):
                per_line.setdefault(index, []).extend((s, e, "q") for s, e in ranges)
        sides[side] = [
            _mark_line(line, per_line.get(index, [])) for index, line in enumerate(lines)
        ]
    kind = _hunk_kind(hunk)
    return {
        "id": hunk["id"],
        "number": number,
        "total": total,
        "kind": kind,
        "kind_label": _KIND_LABELS[kind],
        "old_start": hunk["old_start"],
        "new_start": hunk["new_start"],
        "spacing_only": spacing_only(hunk["removed"], hunk["added"]),
        "marked": marks is not None,
        "context_before": [_clip_context(line, keep="tail") for line in hunk["context_before"][-1:]],
        "context_after": [_clip_context(line, keep="head") for line in hunk["context_after"][:1]],
        "removed": sides["removed"],
        "added": sides["added"],
        "cited_by": [],
    }


def _summary_bullets(record: dict[str, Any]) -> list[dict[str, Any]]:
    summary = record.get("summary")
    if not isinstance(summary, dict):
        return []
    return list(summary.get("bullets") or [])


def _claims(
    bullets: list[dict[str, Any]], hunks: dict[str, dict[str, Any]]
) -> tuple[list[dict[str, Any]], set[str]]:
    """Direction D's reading order: each Claim, numbered, followed by the
    Hunks it cites. A Hunk cited by several Claims renders once, under the
    first; later Claims link back to it, and the Hunk names every Claim that
    cites it. Returns the Claims and the ids of the Hunks placed."""
    claims = []
    placed: dict[str, int] = {}
    for number, bullet in enumerate(bullets, start=1):
        evidence, elsewhere = [], []
        for hunk_id in dict.fromkeys(c["hunk"] for c in bullet["citations"]):
            hunk = hunks[hunk_id]
            hunk["cited_by"].append(number)
            if hunk_id in placed:
                elsewhere.append({"hunk": hunk, "claim": placed[hunk_id]})
            else:
                placed[hunk_id] = number
                evidence.append(hunk)
        claims.append(
            {
                "number": number,
                "id": f"claim-{number}",
                "text": bullet["text"],
                "evidence": evidence,
                "elsewhere": elsewhere,
            }
        )
    return claims, set(placed)


def _coverage_note(record: dict[str, Any]) -> str | None:
    summary = record.get("summary")
    if not isinstance(summary, dict):
        return None
    coverage = summary.get("coverage")
    if not isinstance(coverage, dict):
        return None
    covered, total = coverage.get("covered_hunks"), coverage.get("total_hunks")
    if isinstance(covered, int) and isinstance(total, int) and covered < total:
        return (
            f"This summary covers {covered} of {total} changed passages; "
            "the remaining passages appear below without a summary claim."
        )
    return None


def _change_view(record: dict[str, Any]) -> dict[str, Any]:
    materiality = record["materiality"]
    title = doc_title(record["doc"])
    date = record["detected_at"][:10]
    bullets = _summary_bullets(record)
    quotes: dict[str, dict[str, list[str]]] = {}
    for bullet in bullets:
        for citation in bullet["citations"]:
            sides = quotes.setdefault(citation["hunk"], {})
            sides.setdefault(citation["side"], []).append(citation["quote"])
    total = len(record["hunks"])
    hunks = [
        _hunk_view(hunk, number, total, quotes.get(hunk["id"], {}))
        for number, hunk in enumerate(record["hunks"], start=1)
    ]
    claims, placed = _claims(bullets, {hunk["id"]: hunk for hunk in hunks})
    return {
        "id": record["id"],
        "url": f"/changes/{record['id']}/",
        "company": record["company"],
        "company_url": f"/companies/{record['company']}/",
        "company_name": record["company_name"],
        "doc_title": title,
        "headline": f"{record['company_name']} changed its {title}",
        "date": date,
        "detected_at": record["detected_at"],
        "commit": record["commit"][:7],
        "parent_commit": record["parent_commit"][:7],
        "added_chars": _thousands(materiality["added_chars"]),
        "removed_chars": _thousands(materiality["removed_chars"]),
        "hunk_count": total,
        "passages": _plural(total, "passage"),
        "unchanged": _unchanged_text(materiality["similarity_badge"]),
        "effective_date": _effective_date_text(materiality["effective_date_change"]),
        "effective_date_fact": _effective_date_fact(
            materiality["effective_date_change"]
        ),
        "claims": claims,
        "first_claim": claims[0]["text"] if claims else None,
        "coverage_note": _coverage_note(record),
        "hunks": hunks,
        "has_marks": any(hunk["marked"] for hunk in hunks),
        "rest": [hunk for hunk in hunks if hunk["id"] not in placed],
        "source_url": record["source_url"],
        "source_host": urlsplit(record["source_url"]).netloc or record["source_url"],
    }


def _company_views(
    catalog: list[dict[str, Any]], published: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """One view per company: the union of catalog entries and companies that
    appear in published records (a company dropped from the catalog keeps its
    published history — links must not die). Sorted by slug."""
    companies: dict[str, dict[str, Any]] = {}
    for entry in catalog:
        companies[entry["slug"]] = {
            "slug": entry["slug"],
            "name": entry["name"],
            "url": f"/companies/{entry['slug']}/",
            "doc_urls": dict(entry["policy_urls"]),
            "records": [],
        }
    for record in published:
        company = companies.setdefault(
            record["company"],
            {
                "slug": record["company"],
                "name": record["company_name"],
                "url": f"/companies/{record['company']}/",
                "doc_urls": {},
                "records": [],
            },
        )
        company["doc_urls"].setdefault(record["doc"], record["source_url"])
        company["records"].append(record)
    for company in companies.values():
        last_changed = {
            record["doc"]: record["detected_at"][:10]
            for record in reversed(company["records"])  # oldest last wins → newest
        }
        company["docs"] = [
            {
                "doc": doc,
                "title": doc_title(doc),
                "source_url": url,
                "source_host": urlsplit(url).netloc or url,
                "last_changed": last_changed.get(doc),
            }
            for doc, url in sorted(company["doc_urls"].items())
        ]
        company["doc_list"] = ", ".join(doc["title"] for doc in company["docs"])
        company["change_count"] = len(company["records"])
        company["summary"] = (
            f"{_plural(len(company['docs']), 'document')} watched. "
            f"{_plural(company['change_count'], 'material change')} on record."
        )
    return [companies[slug] for slug in sorted(companies)]


# --------------------------------------------------------------------------
# the builder


@dataclass
class BuildReport:
    pages: int = 0
    published: int = 0
    suppressed: int = 0
    companies: int = 0
    feeds: int = 0
    out_dir: Path | None = None
    page_paths: list[str] = field(default_factory=list)


def _environment() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=True,  # hunk text is untrusted document content
        trim_blocks=True,
        lstrip_blocks=True,
        keep_trailing_newline=True,
    )


class SiteBuilder:
    def __init__(self, *, catalog_path: Path, changes_dir: Path, out_dir: Path) -> None:
        self.catalog_path = Path(catalog_path)
        self.changes_dir = Path(changes_dir)
        self.out_dir = Path(out_dir)
        self.env = _environment()
        from . import feeds  # see build(): feeds.py imports this module

        self.site_url = feeds.SITE_URL

    # -- one page -----------------------------------------------------------

    def _write_page(
        self,
        report: BuildReport,
        relpath: str,
        template: str,
        *,
        title: str,
        description: str,
        nav: str | None = None,
        company_feed: dict[str, str] | None = None,
        share: dict[str, str] | None = None,
        **context: Any,
    ) -> None:
        # Share metadata is text only (no image, no generator): the canonical
        # URL of every page except the 404, which is served from arbitrary
        # paths and so has none.
        url = None
        if relpath != "404.html":
            url = f"{self.site_url}/{relpath.removesuffix('index.html')}"
        html = self.env.get_template(template).render(
            page={
                "title": title,
                "nav": nav,
                "description": description,
                "url": url,
                "share": {"type": "website", "title": title, **(share or {})},
                # Company pages additionally autodiscover their own feed; the
                # global feed link is on every page (base template).
                "company_feed": company_feed,
                # aria-current="page" belongs only on the nav link that IS the
                # current page; descendants mark section membership instead.
                "is_changes_index": relpath == "changes/index.html",
                "is_companies_index": relpath == "companies/index.html",
            },
            **context,
        )
        path = self.out_dir / relpath
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(html, encoding="utf-8", newline="\n")
        report.pages += 1
        report.page_paths.append(relpath)
        log.debug("wrote %s", relpath)

    # -- the build ------------------------------------------------------------

    def build(self) -> BuildReport:
        # Validate EVERYTHING before writing anything: all-or-nothing.
        catalog = load_catalog(self.catalog_path)
        records = load_records(self.changes_dir)
        published = load_published_records(self.changes_dir)

        report = BuildReport(
            published=len(published),
            suppressed=len(records) - len(published),
        )

        changes = [_change_view(record) for record in published]
        companies = _company_views(catalog, published)
        # Listings read alphabetically by name ("Amazon Web Services" files
        # under A, not under its slug "aws"); the slug breaks ties.
        by_name = sorted(companies, key=lambda c: (c["name"].casefold(), c["slug"]))
        catalog_slugs = {entry["slug"] for entry in catalog}
        report.companies = len(companies)
        items_by_company = {company["slug"]: [] for company in companies}
        for change in changes:
            items_by_company[change["company"]].append(change)

        site = {
            "published": len(published),
            # The footer's "generated" moment is the newest record's date —
            # never the wall clock (deterministic rebuilds).
            "latest": published[0]["detected_at"][:10] if published else None,
            # What is watched, counted from the catalog; since a fixed date.
            "documents": sum(len(entry["policy_urls"]) for entry in catalog),
            "catalog_companies": len(catalog),
            "watch_since": WATCH_SINCE,
        }

        if self.out_dir.exists():
            shutil.rmtree(self.out_dir)
        self.out_dir.mkdir(parents=True)

        static_out = self.out_dir / "static"
        static_out.mkdir()
        for name in STYLESHEETS:
            shutil.copyfile(STATIC_DIR / name, static_out / name)
        shutil.copytree(FONTS_DIR, static_out / "fonts")

        self._write_page(
            report,
            "index.html",
            "home.html",
            title="inplain.ai — the record of policy changes",
            description=(
                "What changed in the privacy policies and terms of well-known "
                "companies: the changed passages, a cited summary, and a link "
                "to the source."
            ),
            share={"title": "inplain.ai — the record of policy changes"},
            site=site,
            items=changes[:FEED_LIMIT],
            more=len(changes) > FEED_LIMIT,
            watched=[c for c in by_name if c["slug"] in catalog_slugs],
        )
        self._write_page(
            report,
            "404.html",
            "404.html",
            title="Page not found · inplain.ai",
            description="This page does not exist on inplain.ai.",
            site=site,
        )
        self._write_page(
            report,
            "changes/index.html",
            "changes_index.html",
            title="All changes · inplain.ai",
            description=(
                "Every material change to a watched privacy policy or terms "
                "of service, newest first, with the evidence."
            ),
            nav="changes",
            site=site,
            items=changes,
            companies_with_changes=[c for c in by_name if c["change_count"]],
        )
        self._write_page(
            report,
            "companies/index.html",
            "companies_index.html",
            title="Companies · inplain.ai",
            description=(
                f"The {len(companies)} companies whose privacy policies and "
                "terms of service inplain.ai watches."
            ),
            nav="companies",
            site=site,
            companies=by_name,
        )
        for change in changes:
            description = (
                f"{change['headline']} on {change['date']}: "
                f"{change['passages']} changed, "
                "with citations and a link to the source."
            )
            self._write_page(
                report,
                f"changes/{change['id']}/index.html",
                "change.html",
                title=(
                    f"{change['company_name']} {change['doc_title']} — "
                    f"change of {change['date']} · inplain.ai"
                ),
                nav="changes",
                description=description,
                share={
                    "type": "article",
                    "title": f"{change['headline']} ({change['date']})",
                    # The first Claim is what a share card should say; a
                    # summary-less record falls back to the plain facts.
                    "description": change["first_claim"] or description,
                    "published_time": change["detected_at"],
                },
                site=site,
                change=change,
            )
        # Imported here, not at module top: feeds.py builds on this module's
        # loaders, so the import must run after site.py is fully initialised.
        from . import feeds

        for company in companies:
            self._write_page(
                report,
                f"companies/{company['slug']}/index.html",
                "company.html",
                title=f"{company['name']} — tracked policies · inplain.ai",
                description=(
                    f"How {company['name']}'s watched policy documents have "
                    f"changed: {company['summary']}"
                ),
                nav="companies",
                company_feed={
                    "title": feeds.company_feed_title(company["name"]),
                    "href": f"/companies/{company['slug']}/feed.xml",
                },
                site=site,
                company=company,
                items=items_by_company[company["slug"]],
            )

        # The feeds are part of the site build (AC-8): same publish filter,
        # same output tree, so pages and feeds can never disagree.
        report.feeds = len(
            feeds.write_feeds(
                records=published, companies=companies, out_dir=self.out_dir
            )
        )

        report.out_dir = self.out_dir
        return report


def build_site(
    *, catalog_path: Path, changes_dir: Path, out_dir: Path
) -> BuildReport:
    return SiteBuilder(
        catalog_path=catalog_path, changes_dir=changes_dir, out_dir=out_dir
    ).build()


# --------------------------------------------------------------------------
# CLI


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m inplain.site",
        description=(
            "Build the static site from catalog.json and changes/*.json. "
            "All-or-nothing: one invalid change record fails the whole build "
            "(exit 2) rather than publishing a partial site."
        ),
    )
    parser.add_argument("--root", type=Path, default=None, help="repository root")
    parser.add_argument("--changes", type=Path, default=None, help="changes/ dir")
    parser.add_argument("--catalog", type=Path, default=None, help="catalog.json path")
    parser.add_argument("--out", type=Path, default=None, help="output dir (_site/)")
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.WARNING, format="%(levelname)s %(message)s", stream=sys.stderr
    )
    log.setLevel(logging.DEBUG if args.verbose else logging.INFO)
    root = args.root or _REPO
    try:
        report = build_site(
            catalog_path=args.catalog or root / "catalog.json",
            changes_dir=args.changes or root / "changes",
            out_dir=args.out or root / "_site",
        )
    except (SchemaError, OSError, ValueError) as exc:
        print(f"site build aborted: {exc}", file=sys.stderr)
        return 2
    print(
        f"pages={report.pages} published={report.published} "
        f"suppressed={report.suppressed} companies={report.companies} "
        f"feeds={report.feeds}"
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
