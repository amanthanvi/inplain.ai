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

Run it: ``python -m inplain.site [--root PATH] [--changes PATH]
[--catalog PATH] [--out PATH] [-v]``
"""

from __future__ import annotations

import argparse
import json
import logging
import shutil
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from jinja2 import Environment, FileSystemLoader

from . import schema
from .schema import SchemaError

log = logging.getLogger("inplain.site")

# Templates and stylesheets ship with the package's source tree; they are not
# part of the data root, so --root never relocates them.
_REPO = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = _REPO / "templates"
STATIC_DIR = _REPO / "static"
STYLESHEETS = ("tokens.css", "site.css")

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
# view models — templates receive plain, pre-formatted data


def _thousands(n: int) -> str:
    return f"{n:,}"


def _effective_date_text(change: dict[str, str | None] | None) -> str | None:
    if change is None:
        return None
    date_from, date_to = change.get("from"), change.get("to")
    if date_from and date_to:
        return f"Effective date changed: {date_from} → {date_to}"
    if date_to:
        return f"Effective date added: {date_to}"
    return f"Effective date removed (was {date_from})"


def _hunk_kind(hunk: dict[str, Any]) -> str:
    if hunk["removed"] and hunk["added"]:
        return "replace"
    return "insert" if hunk["added"] else "delete"


def _summary_bullets(record: dict[str, Any]) -> list[dict[str, Any]]:
    """Bullets as the templates render them. A bullet may carry several
    citations into the same hunk (different sides, different quotes); the
    jump target is the hunk, so the link is rendered once per hunk, in
    first-appearance order."""
    summary = record.get("summary")
    if not isinstance(summary, dict):
        return []
    bullets = []
    for bullet in summary.get("bullets") or []:
        hunks = dict.fromkeys(c["hunk"] for c in bullet["citations"])
        bullets.append(
            {"text": bullet["text"], "citations": [{"hunk": h} for h in hunks]}
        )
    return bullets


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
    return {
        "id": record["id"],
        "url": f"/changes/{record['id']}/",
        "company": record["company"],
        "company_url": f"/companies/{record['company']}/",
        "company_name": record["company_name"],
        "doc_title": title,
        "headline": f"{record['company_name']} changed its {title}",
        "date": date,
        "added_chars": _thousands(materiality["added_chars"]),
        "removed_chars": _thousands(materiality["removed_chars"]),
        "hunk_count": len(record["hunks"]),
        "badge": f"{materiality['similarity_badge']:.2f}",
        "effective_date": _effective_date_text(materiality["effective_date_change"]),
        "bullets": _summary_bullets(record),
        "coverage_note": _coverage_note(record),
        "hunks": [{**hunk, "kind": _hunk_kind(hunk)} for hunk in record["hunks"]],
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
                "last_changed": last_changed.get(doc),
            }
            for doc, url in sorted(company["doc_urls"].items())
        ]
        company["change_count"] = len(company["records"])
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

    # -- one page -----------------------------------------------------------

    def _write_page(
        self,
        report: BuildReport,
        relpath: str,
        template: str,
        *,
        title: str,
        nav: str | None = None,
        description: str | None = None,
        company_feed: dict[str, str] | None = None,
        **context: Any,
    ) -> None:
        html = self.env.get_template(template).render(
            page={
                "title": title,
                "nav": nav,
                "description": description,
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
        report.companies = len(companies)
        items_by_company = {company["slug"]: [] for company in companies}
        for change in changes:
            items_by_company[change["company"]].append(change)

        site = {
            "published": len(published),
            # The footer's "generated" moment is the newest record's date —
            # never the wall clock (deterministic rebuilds).
            "latest": published[0]["detected_at"][:10] if published else None,
        }

        if self.out_dir.exists():
            shutil.rmtree(self.out_dir)
        self.out_dir.mkdir(parents=True)

        static_out = self.out_dir / "static"
        static_out.mkdir()
        for name in STYLESHEETS:
            shutil.copyfile(STATIC_DIR / name, static_out / name)

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
            site=site,
            items=changes[:FEED_LIMIT],
            more=len(changes) > FEED_LIMIT,
        )
        self._write_page(
            report,
            "404.html",
            "404.html",
            title="Page not found · inplain.ai",
            site=site,
        )
        self._write_page(
            report,
            "changes/index.html",
            "changes_index.html",
            title="All changes · inplain.ai",
            nav="changes",
            site=site,
            items=changes,
            companies_with_changes=[c for c in companies if c["change_count"]],
        )
        self._write_page(
            report,
            "companies/index.html",
            "companies_index.html",
            title="Companies · inplain.ai",
            nav="companies",
            site=site,
            companies=companies,
        )
        for change in changes:
            self._write_page(
                report,
                f"changes/{change['id']}/index.html",
                "change.html",
                title=(
                    f"{change['company_name']} {change['doc_title']} — "
                    f"change of {change['date']} · inplain.ai"
                ),
                nav="changes",
                description=(
                    f"{change['headline']} on {change['date']}: "
                    f"{change['hunk_count']} changed "
                    f"{'passage' if change['hunk_count'] == 1 else 'passages'}, "
                    "with citations and a link to the source."
                ),
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
