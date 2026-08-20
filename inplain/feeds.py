"""T5 — Atom feeds, global and per company, into ``_site/`` (AC-8).

With no accounts and no email, the feeds are the only mechanism that brings
anyone back. One global feed at ``/feed.xml`` and one per company at
``/companies/<slug>/feed.xml``, generated as part of the site build
(:meth:`inplain.site.SiteBuilder.build` calls :func:`write_feeds`) and also
runnable standalone as ``python -m inplain.feeds``.

Load-bearing decisions:

* **The publish filter is shared.** Entries come from
  :func:`inplain.site.load_published_records` — the exact list the site
  publishes, so the feeds and the pages can never disagree about what is
  public. Suppressed records never appear.
* **Entry ids are permanent.** Each entry's ``atom:id`` is a tag URI
  (RFC 4151) built from a fixed authority, a FIXED date, and the change
  record's id: ``tag:inplain.ai,2026-08-19:change/<record-id>``. The record id
  is immutable once published (G1: ``<company>-<doc>-<shortsha7>`` from the
  document commit) and the tag date is the date this scheme was fixed — it is
  a constant, never derived from the record. Nothing mutable (summary
  presence, bullet count, coverage, timestamps) feeds the id, so an id can
  never change once published and no reader ever re-surfaces old entries.
* **A feed is a notification; the page is the record.** An entry carries the
  change title, the date, the summary bullet text, and the link to the change
  page — never the hunks. A material change whose summary did not validate
  still gets an entry with an honest "no validated summary" line (the same
  stance as the change page).
* **Escaping is structural.** Feeds are built with ``xml.etree.ElementTree``,
  so attacker-steerable text (bullet text derives from tracked policy
  documents) is escaped by the serializer, not by remembering to call an
  escape function.
* **Deterministic output.** No wall clock: every timestamp comes from
  ``detected_at`` (``updated`` of an empty feed is a fixed constant), so
  identical inputs rebuild byte-identically.

Run it: ``python -m inplain.feeds [--root PATH] [--changes PATH]
[--catalog PATH] [--out PATH] [-v]`` — exit 2 on any invalid record.
"""

from __future__ import annotations

import argparse
import logging
import sys
import xml.etree.ElementTree as ET
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from .schema import SchemaError
from .site import doc_title, load_catalog, load_published_records

log = logging.getLogger("inplain.feeds")

_REPO = Path(__file__).resolve().parent.parent

ATOM_NS = "http://www.w3.org/2005/Atom"
# Serialize Atom as the default namespace (plain <feed>, <entry>, …).
# ``default_namespace=`` on tostring() cannot be used instead: it rejects the
# unqualified attributes (rel, href, type) Atom links require.
ET.register_namespace("", ATOM_NS)

# The canonical origin the feeds link to (hosting decision: docs/hosting.md).
# Feed READERS need absolute URLs; the pages themselves keep root-relative
# links.
SITE_URL = "https://inplain.ai"

# Tag-URI scheme (RFC 4151): authority + the FIXED date the scheme was
# adopted. Changing either would change every published entry id and make
# every reader re-surface the whole history — do not touch.
TAG_AUTHORITY = "inplain.ai"
TAG_DATE = "2026-08-19"

AUTHOR_NAME = "inplain.ai"
GLOBAL_FEED_TITLE = "inplain.ai — material policy changes"
SUBTITLE = "What changed, why it matters, and the evidence."

# A feed is a window, not the archive; readers keep what they already saw and
# the full history lives at /changes/. Applies to the global feed and (for
# symmetry) per-company feeds, where it is far from binding.
FEED_ENTRY_LIMIT = 50

# `updated` of a feed with no entries yet. Atom requires the element; a fixed
# instant is the deterministic, honest "never updated".
EMPTY_FEED_UPDATED = "1970-01-01T00:00:00Z"

NO_SUMMARY_TEXT = (
    "No validated summary yet for this change. Every claim we publish must "
    "cite the changed text verbatim; none validated here. The change page "
    "carries the changed passages in full."
)


def entry_id(record_id: str) -> str:
    """The permanent ``atom:id`` for a change record (see module docstring)."""
    return f"tag:{TAG_AUTHORITY},{TAG_DATE}:change/{record_id}"


def feed_tag_id(name: str) -> str:
    return f"tag:{TAG_AUTHORITY},{TAG_DATE}:feed/{name}"


def company_feed_title(name: str) -> str:
    return f"{name} — material policy changes · inplain.ai"


def feed_companies(
    catalog: list[dict[str, Any]], published: list[dict[str, Any]]
) -> list[dict[str, str]]:
    """One ``{slug, name}`` per company feed: the union of catalog companies
    and companies appearing in published records — exactly the set the site
    generates pages for, so every autodiscovery link has a target. Sorted by
    slug (deterministic)."""
    names = {entry["slug"]: entry["name"] for entry in catalog}
    for record in published:
        names.setdefault(record["company"], record["company_name"])
    return [{"slug": slug, "name": names[slug]} for slug in sorted(names)]


# --------------------------------------------------------------------------
# building one feed document


def _el(parent: ET.Element, tag: str, text: str | None = None, **attrs: str) -> ET.Element:
    element = ET.SubElement(parent, f"{{{ATOM_NS}}}{tag}", attrs)
    if text is not None:
        element.text = text
    return element


def _entry_text(record: dict[str, Any]) -> str:
    """The notification body: summary bullet text only — never the hunks."""
    summary = record.get("summary")
    bullets = summary.get("bullets") if isinstance(summary, dict) else None
    if bullets:
        return "\n".join(f"• {bullet['text']}" for bullet in bullets)
    return NO_SUMMARY_TEXT


def _append_entry(feed: ET.Element, record: dict[str, Any]) -> None:
    date = record["detected_at"][:10]
    title = f"{record['company_name']} changed its {doc_title(record['doc'])} — {date}"
    entry = _el(feed, "entry")
    _el(entry, "id", entry_id(record["id"]))
    _el(entry, "title", title, type="text")
    _el(entry, "updated", record["detected_at"])
    _el(entry, "published", record["detected_at"])
    _el(
        entry,
        "link",
        rel="alternate",
        type="text/html",
        href=f"{SITE_URL}/changes/{record['id']}/",
    )
    _el(entry, "content", _entry_text(record), type="text")


def _feed_document(
    *,
    tag_name: str,
    title: str,
    page_path: str,
    feed_path: str,
    records: Sequence[dict[str, Any]],
    subtitle: str | None = None,
) -> bytes:
    """One complete Atom document. ``records`` must be newest-first
    (:func:`load_published_records` order); the feed's ``updated`` is the
    newest entry's ``detected_at`` — never the wall clock."""
    feed = ET.Element(f"{{{ATOM_NS}}}feed")
    _el(feed, "id", feed_tag_id(tag_name))
    _el(feed, "title", title, type="text")
    if subtitle is not None:
        _el(feed, "subtitle", subtitle, type="text")
    updated = records[0]["detected_at"] if records else EMPTY_FEED_UPDATED
    _el(feed, "updated", updated)
    author = _el(feed, "author")
    _el(author, "name", AUTHOR_NAME)
    _el(feed, "link", rel="self", type="application/atom+xml", href=f"{SITE_URL}{feed_path}")
    _el(feed, "link", rel="alternate", type="text/html", href=f"{SITE_URL}{page_path}")
    for record in records:
        _append_entry(feed, record)
    ET.indent(feed, space="  ")
    xml = ET.tostring(feed, encoding="unicode")
    return ('<?xml version="1.0" encoding="utf-8"?>\n' + xml + "\n").encode("utf-8")


# --------------------------------------------------------------------------
# the writer


def write_feeds(
    *,
    records: Sequence[dict[str, Any]],
    companies: Sequence[dict[str, str]],
    out_dir: Path,
) -> list[str]:
    """Write the global feed and one feed per company into ``out_dir``
    (which the site build has already created; directories are made as
    needed). ``records`` is the published list, newest first; ``companies``
    is :func:`feed_companies`' output (or the site's company views — anything
    with ``slug`` and ``name``). Returns the relative paths written."""
    out_dir = Path(out_dir)
    written: list[str] = []

    def write(relpath: str, data: bytes) -> None:
        path = out_dir / relpath
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        written.append(relpath)
        log.debug("wrote %s", relpath)

    write(
        "feed.xml",
        _feed_document(
            tag_name="global",
            title=GLOBAL_FEED_TITLE,
            subtitle=SUBTITLE,
            page_path="/",
            feed_path="/feed.xml",
            records=records[:FEED_ENTRY_LIMIT],
        ),
    )
    by_company: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        by_company.setdefault(record["company"], []).append(record)
    for company in companies:
        slug = company["slug"]
        write(
            f"companies/{slug}/feed.xml",
            _feed_document(
                tag_name=f"company/{slug}",
                title=company_feed_title(company["name"]),
                page_path=f"/companies/{slug}/",
                feed_path=f"/companies/{slug}/feed.xml",
                records=by_company.get(slug, [])[:FEED_ENTRY_LIMIT],
            ),
        )
    return written


# --------------------------------------------------------------------------
# CLI — standalone generation into an existing _site/ (CI can also rely on
# the site build, which calls write_feeds itself; this exists so every
# module is runnable on its own).


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m inplain.feeds",
        description=(
            "Generate the Atom feeds (global + per company) from catalog.json "
            "and changes/*.json into the site output directory. One invalid "
            "change record aborts the whole run (exit 2)."
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
        catalog = load_catalog(args.catalog or root / "catalog.json")
        published = load_published_records(args.changes or root / "changes")
        written = write_feeds(
            records=published,
            companies=feed_companies(catalog, published),
            out_dir=args.out or root / "_site",
        )
    except (SchemaError, OSError, ValueError) as exc:
        print(f"feed build aborted: {exc}", file=sys.stderr)
        return 2
    print(f"feeds={len(written)} published={len(published)}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
