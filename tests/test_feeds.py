"""T5 — the Atom feeds (AC-8).

Validated by parser, not by eye: every generated feed must round-trip through
``feedparser`` with ``bozo == 0`` and carry the RFC-4287 requirements (feed
and entry ids, ``updated`` everywhere, an author, self + alternate links).
Entry ids must be PERMANENT — nothing mutable (summary presence, bullets,
coverage) may leak into them — and the feed body carries bullet text only,
never the hunks. The fixture reuses test_site's record factory so the feeds
are exercised against exactly the inputs the site publishes.
"""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import feedparser
import pytest

from inplain import feeds, schema
from inplain.feeds import (
    EMPTY_FEED_UPDATED,
    NO_SUMMARY_TEXT,
    SITE_URL,
    entry_id,
)
from inplain.site import build_site

from .test_site import (
    CATALOG,
    SUPPRESSED_MARKER,
    base_record,
    make_records,
    read_pages,
    sha,
    write_inputs,
)

# Attacker-steerable text: bullet prose derives from tracked policy documents,
# so a hostile policy can steer what lands inside the XML.
HOSTILE_BULLET = (
    'The new terms load <script>alert("feed")</script> trackers '
    "and try to break out with ]]> mid-sentence."
)
HOSTILE_LINE = "We now load third-party trackers on every page."

# Lives ONLY in the script record's hunks (that record has no summary): if it
# shows up in a feed, the feed leaked hunk content.
SCRIPT_HUNK_TEXT = 'We embed <script>alert("owned")</script> in our terms.'


def hostile_record() -> dict:
    """A material change whose SUMMARY BULLET carries hostile markup."""
    record = base_record(
        "example",
        "privacy",
        sha("2"),
        "2026-08-07T09:00:00Z",
        [
            {
                "id": "h1",
                "old_start": 30,
                "new_start": 30,
                "context_before": [],
                "removed": [],
                "added": [HOSTILE_LINE],
                "context_after": [],
                "word_spans": None,
            }
        ],
    )
    record["summary"] = {
        "model": "golden-expected",
        "generated_at": record["detected_at"],
        "coverage": {"covered_hunks": 1, "total_hunks": 1},
        "bullets": [
            {
                "text": HOSTILE_BULLET,
                "citations": [{"hunk": "h1", "side": "added", "quote": HOSTILE_LINE}],
            }
        ],
    }
    return record


def make_feed_records() -> dict[str, dict]:
    records = make_records()
    records["hostile"] = hostile_record()
    return records


# One catalog company with no published changes: its page and feed must still
# exist (subscribe before the first change) and the empty feed must validate.
QUIET = {
    "slug": "quiet",
    "name": "Quiet Co",
    "website_url": "https://quiet.test",
    "category": "other",
    "policy_urls": {"privacy": "https://quiet.test/privacy"},
}


def write_feed_inputs(root: Path, records: dict[str, dict]) -> None:
    write_inputs(root, records)
    (root / "catalog.json").write_text(
        json.dumps([*CATALOG, QUIET], indent=2) + "\n", encoding="utf-8", newline="\n"
    )


# Global feed order: newest first, exactly load_published_records' order.
GLOBAL_ORDER = ("hostile", "script", "injection", "wholesale", "effdate", "negation")
EXAMPLE_ORDER = ("hostile", "injection", "wholesale", "effdate", "negation")


@pytest.fixture(scope="module")
def built(tmp_path_factory: pytest.TempPathFactory) -> SimpleNamespace:
    root = tmp_path_factory.mktemp("feed-build")
    records = make_feed_records()
    write_feed_inputs(root, records)
    out = root / "_site"
    report = build_site(
        catalog_path=root / "catalog.json", changes_dir=root / "changes", out_dir=out
    )
    raw = {
        path.relative_to(out).as_posix(): path.read_bytes()
        for path in sorted(out.rglob("*.xml"))
    }
    return SimpleNamespace(
        root=root,
        out=out,
        report=report,
        records=records,
        raw=raw,
        pages=read_pages(out),
    )


def parse(built: SimpleNamespace, relpath: str) -> feedparser.FeedParserDict:
    return feedparser.parse(built.raw[relpath])


# ------------------------------------------------------------------- surfaces


def test_feeds_written_alongside_the_pages(built: SimpleNamespace) -> None:
    assert set(built.raw) == {
        "feed.xml",
        "companies/example/feed.xml",
        "companies/other/feed.xml",
        "companies/quiet/feed.xml",
    }
    assert built.report.feeds == 4


# ------------------------------------------------- well-formedness (AC-8)


def test_every_feed_is_well_formed_atom(built: SimpleNamespace) -> None:
    for relpath in built.raw:
        parsed = feedparser.parse(built.raw[relpath])
        assert not parsed.bozo, f"{relpath}: {parsed.get('bozo_exception')}"
        assert parsed.version == "atom10", relpath


def test_feed_level_requirements(built: SimpleNamespace) -> None:
    """RFC 4287: atom:feed carries id, title, updated, author; plus a self
    link and an alternate link back to the page the feed notifies about."""
    for relpath, page_path in [
        ("feed.xml", "/"),
        ("companies/example/feed.xml", "/companies/example/"),
        ("companies/quiet/feed.xml", "/companies/quiet/"),
    ]:
        feed = parse(built, relpath).feed
        assert feed.id.startswith("tag:inplain.ai,2026-08-19:feed/"), relpath
        assert feed.title, relpath
        assert feed.updated, relpath
        assert feed.author_detail.name == "inplain.ai", relpath
        links = {link.rel: link for link in feed.links}
        assert links["self"].href == f"{SITE_URL}/{relpath}"
        assert links["self"].type == "application/atom+xml"
        assert links["alternate"].href == f"{SITE_URL}{page_path}"


def test_entry_requirements(built: SimpleNamespace) -> None:
    """RFC 4287: every entry carries id, title, updated, and a link."""
    for relpath in built.raw:
        for entry in parse(built, relpath).entries:
            assert entry.id and entry.title and entry.updated and entry.link, relpath


def test_feed_updated_is_newest_entry_never_wall_clock(built: SimpleNamespace) -> None:
    assert parse(built, "feed.xml").feed.updated == "2026-08-07T09:00:00Z"
    assert parse(built, "companies/other/feed.xml").feed.updated == "2026-08-05T09:00:00Z"


def test_empty_company_feed_is_valid(built: SimpleNamespace) -> None:
    parsed = parse(built, "companies/quiet/feed.xml")
    assert not parsed.bozo
    assert parsed.entries == []
    assert parsed.feed.updated == EMPTY_FEED_UPDATED


# ----------------------------------------------------------- entry content


def test_global_feed_order_and_links(built: SimpleNamespace) -> None:
    entries = parse(built, "feed.xml").entries
    expected = [built.records[key]["id"] for key in GLOBAL_ORDER]
    assert [e.link for e in entries] == [
        f"{SITE_URL}/changes/{record_id}/" for record_id in expected
    ]
    for entry, key in zip(entries, GLOBAL_ORDER):
        record = built.records[key]
        assert entry.updated == record["detected_at"]
        assert record["company_name"] in entry.title
        assert record["detected_at"][:10] in entry.title


def test_company_feeds_carry_only_their_company(built: SimpleNamespace) -> None:
    example = parse(built, "companies/example/feed.xml").entries
    assert [e.link for e in example] == [
        f"{SITE_URL}/changes/{built.records[key]['id']}/" for key in EXAMPLE_ORDER
    ]
    other = parse(built, "companies/other/feed.xml").entries
    assert [e.link for e in other] == [
        f"{SITE_URL}/changes/{built.records['script']['id']}/"
    ]


def test_entry_links_resolve_to_generated_pages(built: SimpleNamespace) -> None:
    for relpath in built.raw:
        for entry in parse(built, relpath).entries:
            assert entry.link.startswith(f"{SITE_URL}/")
            page = built.out / entry.link.removeprefix(f"{SITE_URL}/") / "index.html"
            assert page.is_file(), f"{relpath}: {entry.link} has no generated page"


def test_entries_carry_bullet_text_never_hunks(built: SimpleNamespace) -> None:
    entries = {e.link: e for e in parse(built, "feed.xml").entries}
    negation = entries[f"{SITE_URL}/changes/{built.records['negation']['id']}/"]
    assert "narrower promise about" in negation.content[0].value  # the bullet text
    assert negation.content[0].type == "text/plain"
    # The feed is a notification, the page is the record: no hunk text, ever.
    for relpath, raw in built.raw.items():
        assert SCRIPT_HUNK_TEXT.encode() not in raw, f"hunk text leaked into {relpath}"
        assert b"context_before" not in raw, relpath


def test_unsummarised_material_change_gets_an_honest_entry(
    built: SimpleNamespace,
) -> None:
    entries = {e.link: e for e in parse(built, "feed.xml").entries}
    injection = entries[f"{SITE_URL}/changes/{built.records['injection']['id']}/"]
    assert injection.title and injection.updated  # title/date/link all present
    assert "No validated summary yet" in injection.content[0].value
    assert injection.content[0].value == NO_SUMMARY_TEXT


# ------------------------------------------------------- suppression, escaping


def test_suppressed_records_absent_from_every_feed(built: SimpleNamespace) -> None:
    suppressed_id = built.records["suppressed"]["id"]
    for relpath, raw in built.raw.items():
        text = raw.decode("utf-8")
        assert suppressed_id not in text, f"suppressed id leaked into {relpath}"
        assert SUPPRESSED_MARKER not in text, f"suppressed content leaked into {relpath}"


def test_hostile_bullet_text_stays_escaped(built: SimpleNamespace) -> None:
    """Bullet text can be steered by a tracked policy: raw markup and CDATA
    breakouts must never reach the XML unescaped."""
    for relpath in ("feed.xml", "companies/example/feed.xml"):
        raw = built.raw[relpath]
        assert b"<script" not in raw, relpath
        assert b"]]>" not in raw, relpath
        assert b"&lt;script&gt;" in raw, relpath
        # And the text survives the round-trip intact as DATA.
        entries = {e.link: e for e in parse(built, relpath).entries}
        hostile = entries[f"{SITE_URL}/changes/{built.records['hostile']['id']}/"]
        assert hostile.content[0].value == f"• {HOSTILE_BULLET}"


# ------------------------------------------------------------- id stability


def test_entry_ids_are_the_documented_tag_uris(built: SimpleNamespace) -> None:
    entries = parse(built, "feed.xml").entries
    assert [e.id for e in entries] == [
        f"tag:inplain.ai,2026-08-19:change/{built.records[key]['id']}"
        for key in GLOBAL_ORDER
    ]
    assert entries[0].id == entry_id(built.records["hostile"]["id"])


def test_ids_unique_within_each_feed(built: SimpleNamespace) -> None:
    for relpath in built.raw:
        ids = [e.id for e in parse(built, relpath).entries]
        assert len(ids) == len(set(ids)), relpath


def test_rebuild_is_byte_identical_ids_included(built: SimpleNamespace) -> None:
    out2 = built.root / "_site-second"
    build_site(
        catalog_path=built.root / "catalog.json",
        changes_dir=built.root / "changes",
        out_dir=out2,
    )
    for relpath, raw in built.raw.items():
        assert (out2 / relpath).read_bytes() == raw, relpath


def test_entry_id_never_embeds_anything_mutable(tmp_path: Path) -> None:
    """The one hard rule: an id must not change once published. Summarising a
    previously unsummarised record — new bullets, new coverage — must leave
    its id byte-identical, because the id derives ONLY from the immutable
    record id (G1)."""
    records = make_feed_records()
    write_feed_inputs(tmp_path, records)
    build_site(
        catalog_path=tmp_path / "catalog.json",
        changes_dir=tmp_path / "changes",
        out_dir=tmp_path / "_site",
    )
    before = {
        e.link: e.id
        for e in feedparser.parse((tmp_path / "_site" / "feed.xml").read_bytes()).entries
    }

    # The injection record gains a validated summary; the wholesale record's
    # coverage and bullet count change. Neither may move an id.
    injection = records["injection"]
    injection["summary"] = {
        "model": "later-model",
        "generated_at": "2026-08-10T00:00:00Z",
        "coverage": {"covered_hunks": 1, "total_hunks": len(injection["hunks"])},
        "bullets": [
            {
                "text": "A validated claim arrived later.",
                "citations": [
                    {
                        "hunk": injection["hunks"][0]["id"],
                        "side": "added" if injection["hunks"][0]["added"] else "removed",
                        "quote": "later",
                    }
                ],
            }
        ],
    }
    wholesale = records["wholesale"]
    wholesale["summary"]["coverage"]["covered_hunks"] = 1
    wholesale["summary"]["bullets"] = wholesale["summary"]["bullets"][:1]
    for record in (injection, wholesale):
        schema.dump_record(record, tmp_path / "changes" / f"{record['id']}.json")

    build_site(
        catalog_path=tmp_path / "catalog.json",
        changes_dir=tmp_path / "changes",
        out_dir=tmp_path / "_site2",
    )
    after = {
        e.link: e.id
        for e in feedparser.parse((tmp_path / "_site2" / "feed.xml").read_bytes()).entries
    }
    assert after == before


# ------------------------------------------------------------ autodiscovery


def test_global_feed_autodiscovered_on_every_page(built: SimpleNamespace) -> None:
    needle = 'rel="alternate" type="application/atom+xml"'
    for path, html in built.pages.items():
        assert needle in html, f"{path}: no Atom autodiscovery link"
        assert 'href="/feed.xml"' in html, f"{path}: no global feed link"


def test_company_feed_autodiscovered_on_company_pages_only(
    built: SimpleNamespace,
) -> None:
    for slug in ("example", "other", "quiet"):
        html = built.pages[f"companies/{slug}/index.html"]
        assert f'href="/companies/{slug}/feed.xml"' in html
    for path in ("index.html", "changes/index.html", "companies/index.html"):
        assert "/feed.xml" in built.pages[path]
        assert "companies/example/feed.xml" not in built.pages[path]
    change_page = built.pages[f"changes/{built.records['negation']['id']}/index.html"]
    assert "companies/example/feed.xml" not in change_page


def test_autodiscovery_hrefs_resolve_to_generated_feeds(
    built: SimpleNamespace,
) -> None:
    for slug in ("example", "other", "quiet"):
        assert (built.out / "companies" / slug / "feed.xml").is_file()
    assert (built.out / "feed.xml").is_file()


# ---------------------------------------------------------------------- CLI


def test_cli_generates_feeds_standalone(
    tmp_path: Path, capsys: pytest.CaptureFixture
) -> None:
    write_feed_inputs(tmp_path, make_feed_records())
    code = feeds.main(
        [
            "--root",
            str(tmp_path),
            "--changes",
            str(tmp_path / "changes"),
            "--catalog",
            str(tmp_path / "catalog.json"),
            "--out",
            str(tmp_path / "_site"),
        ]
    )
    assert code == 0
    assert "feeds=4 published=6" in capsys.readouterr().out
    parsed = feedparser.parse((tmp_path / "_site" / "feed.xml").read_bytes())
    assert not parsed.bozo
    assert len(parsed.entries) == 6


def test_cli_exits_2_on_invalid_record(
    tmp_path: Path, capsys: pytest.CaptureFixture
) -> None:
    records = make_feed_records()
    write_feed_inputs(tmp_path, records)
    bad = dict(records["negation"])
    bad["id"] = "example-privacy-zzzzzzz"  # id does not match its commit
    (tmp_path / "changes" / f"{bad['id']}.json").write_text(
        json.dumps(bad, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n"
    )
    out = tmp_path / "_site"
    code = feeds.main(
        [
            "--changes",
            str(tmp_path / "changes"),
            "--catalog",
            str(tmp_path / "catalog.json"),
            "--out",
            str(out),
        ]
    )
    assert code == 2
    assert "aborted" in capsys.readouterr().err
    assert not out.exists(), "a failed feed build must not publish partial feeds"
