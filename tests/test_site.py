"""T4 — the static site generator (AC-7).

The fixture site is built from eval/golden-derived change records in a temp
directory; no test touches the network and nothing under ``documents/`` is
ever read by the builder (a canary string proves it).
"""

from __future__ import annotations

import html as htmllib
import json
import re
from pathlib import Path
from types import SimpleNamespace

import pytest

from inplain import schema, site
from inplain.site import build_site, load_published_records

GOLDEN_DIR = Path(__file__).resolve().parents[1] / "eval" / "golden"

# Lives ONLY in documents/ — if it shows up in any page, the builder read the
# full document text, which SPEC §5 forbids.
CANARY = "FULL-DOCUMENT-CANARY-9f31 this sentence exists only in documents/"

# Lives ONLY in the suppressed (material: false) record.
SUPPRESSED_MARKER = "SUPPRESSED-MARKER-b6f2 cosmetic tweak"

CATALOG = [
    {
        "slug": "example",
        "name": "Example",
        "website_url": "https://example.com",
        "category": "other",
        "policy_urls": {"privacy": "https://example.com/privacy"},
    },
    {
        "slug": "other",
        "name": "Other Co",
        "website_url": "https://other.test",
        "category": "other",
        "policy_urls": {"tos": "https://other.test/terms"},
    },
]

HREF = re.compile(r'href="([^"]+)"')


def sha(char: str) -> str:
    return char * 40


def base_record(
    company: str,
    doc: str,
    commit: str,
    detected_at: str,
    hunks: list[dict],
    *,
    company_name: str | None = None,
    material: bool = True,
    reason: str = "added_prose_exceeds_sentence_threshold",
    effective_date_change: dict | None = None,
) -> dict:
    added = [line for hunk in hunks for line in hunk["added"]]
    removed = [line for hunk in hunks for line in hunk["removed"]]
    return {
        "schema_version": 1,
        "id": schema.record_id(company, doc, commit),
        "company": company,
        "company_name": company_name or company.capitalize(),
        "doc": doc,
        "source_url": f"https://{company}.test/{doc}",
        "commit": commit,
        "parent_commit": sha("f"),
        "detected_at": detected_at,
        "materiality": {
            "material": material,
            "reason": reason,
            "added_chars": sum(len(line) for line in added),
            "removed_chars": sum(len(line) for line in removed),
            "similarity_badge": 0.97,
            "effective_date_change": effective_date_change,
        },
        "hunks": hunks,
    }


def record_from_golden(
    name: str,
    commit: str,
    detected_at: str,
    *,
    with_summary: bool = True,
    coverage: dict | None = None,
    effective_date_change: dict | None = None,
) -> dict:
    entry = json.loads((GOLDEN_DIR / f"{name}.json").read_text(encoding="utf-8"))
    record = base_record(
        entry["company"],
        entry["doc"],
        commit,
        detected_at,
        entry["hunks"],
        effective_date_change=effective_date_change,
    )
    if with_summary:
        record["summary"] = {
            "model": "golden-expected",
            "generated_at": detected_at,
            "coverage": coverage
            or {"covered_hunks": len(entry["hunks"]), "total_hunks": len(entry["hunks"])},
            "bullets": entry["expected"]["bullets"],
        }
    return record


def make_records() -> dict[str, dict]:
    """Five publishable records (golden-derived plus one hostile-markup one)
    and one suppressed record."""
    return {
        "negation": record_from_golden(
            "constructed-negation-sell-to-share", sha("a"), "2026-05-01T09:00:00Z"
        ),
        "effdate": record_from_golden(
            "constructed-effective-date-only",
            sha("b"),
            "2026-06-02T09:00:00Z",
            effective_date_change={"from": "2025-01-01", "to": "2026-03-15"},
        ),
        "wholesale": record_from_golden(
            "constructed-wholesale-rewrite-partial",
            sha("c"),
            "2026-07-03T09:00:00Z",
            coverage={"covered_hunks": 3, "total_hunks": 6},
        ),
        # The injection entry ships WITHOUT a summary: the honest empty state.
        "injection": record_from_golden(
            "constructed-prompt-injection-in-hunk",
            sha("d"),
            "2026-08-04T09:00:00Z",
            with_summary=False,
        ),
        # Hostile markup inside hunk text must render as escaped data.
        "script": base_record(
            "other",
            "tos",
            sha("e"),
            "2026-08-05T09:00:00Z",
            [
                {
                    "id": "h1",
                    "old_start": 4,
                    "new_start": 4,
                    "context_before": [],
                    "removed": [],
                    "added": ['We embed <script>alert("owned")</script> in our terms.'],
                    "context_after": [],
                    "word_spans": None,
                }
            ],
            company_name="Other Co",
        ),
        "suppressed": base_record(
            "example",
            "privacy",
            sha("1"),
            "2026-08-06T09:00:00Z",
            [
                {
                    "id": "h1",
                    "old_start": 9,
                    "new_start": 9,
                    "context_before": [],
                    "removed": [],
                    "added": [SUPPRESSED_MARKER],
                    "context_after": [],
                    "word_spans": None,
                }
            ],
            material=False,
            reason="below_sentence_threshold",
        ),
    }


def write_inputs(root: Path, records: dict[str, dict]) -> None:
    (root / "catalog.json").write_text(
        json.dumps(CATALOG, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    changes = root / "changes"
    changes.mkdir()
    for record in records.values():
        schema.dump_record(record, changes / f"{record['id']}.json")
    docs = root / "documents" / "example"
    docs.mkdir(parents=True)
    (docs / "privacy.txt").write_text(CANARY, encoding="utf-8", newline="\n")


def read_pages(out: Path) -> dict[str, str]:
    return {
        path.relative_to(out).as_posix(): path.read_text(encoding="utf-8")
        for path in sorted(out.rglob("*.html"))
    }


@pytest.fixture(scope="module")
def built(tmp_path_factory: pytest.TempPathFactory) -> SimpleNamespace:
    root = tmp_path_factory.mktemp("site-build")
    records = make_records()
    write_inputs(root, records)
    out = root / "_site"
    report = build_site(
        catalog_path=root / "catalog.json", changes_dir=root / "changes", out_dir=out
    )
    return SimpleNamespace(
        root=root, out=out, report=report, records=records, pages=read_pages(out)
    )


def change_page(built: SimpleNamespace, key: str) -> str:
    record_id = built.records[key]["id"]
    return built.pages[f"changes/{record_id}/index.html"]


def build_one(root: Path, record: dict) -> str:
    """Build a site holding just ``record``; return its change page."""
    (root / "catalog.json").write_text(json.dumps(CATALOG), encoding="utf-8")
    changes = root / "changes"
    changes.mkdir()
    schema.dump_record(record, changes / f"{record['id']}.json")
    out = root / "_site"
    build_site(catalog_path=root / "catalog.json", changes_dir=changes, out_dir=out)
    return (out / "changes" / record["id"] / "index.html").read_text(encoding="utf-8")


# --------------------------------------------------------------------- shape


def test_report_and_surfaces(built: SimpleNamespace) -> None:
    assert built.report.published == 5
    assert built.report.suppressed == 1
    assert built.report.companies == 2
    expected = {"index.html", "404.html", "changes/index.html", "companies/index.html"}
    for key in ("negation", "effdate", "wholesale", "injection", "script"):
        expected.add(f"changes/{built.records[key]['id']}/index.html")
    expected |= {"companies/example/index.html", "companies/other/index.html"}
    assert set(built.pages) == expected
    assert built.report.pages == len(expected)


def test_stylesheets_copied_byte_identical(built: SimpleNamespace) -> None:
    for name in ("tokens.css", "site.css"):
        assert (built.out / "static" / name).read_bytes() == (
            site.STATIC_DIR / name
        ).read_bytes()


def test_literata_is_self_hosted(built: SimpleNamespace) -> None:
    """The typeface ships with the site: both Literata files land in
    _site/static/fonts/, byte-identical, and no page or stylesheet asks a
    third party for a font."""
    fonts = sorted(p.name for p in (built.out / "static" / "fonts").iterdir())
    assert fonts == ["Literata-italic-latin.woff2", "Literata-latin.woff2"]
    for name in fonts:
        assert (built.out / "static" / "fonts" / name).read_bytes() == (
            site.STATIC_DIR / "fonts" / name
        ).read_bytes()
    tokens = (built.out / "static" / "tokens.css").read_text(encoding="utf-8")
    assert "font-display: swap" in tokens
    assert 'url("/static/fonts/Literata-latin.woff2")' in tokens
    for path, html in built.pages.items():
        assert "fonts.googleapis" not in html and "fonts.gstatic" not in html, path


# --------------------------------------------- suppression and content policy


def test_suppressed_record_never_published_or_linked(built: SimpleNamespace) -> None:
    suppressed_id = built.records["suppressed"]["id"]
    assert not (built.out / "changes" / suppressed_id).exists()
    for path, html in built.pages.items():
        assert suppressed_id not in html, f"suppressed id leaked into {path}"
        assert SUPPRESSED_MARKER not in html, f"suppressed content leaked into {path}"


def test_full_document_text_never_published(built: SimpleNamespace) -> None:
    """SPEC §5: nothing from documents/ is read at all — the canary string
    that exists only there must not appear in any page."""
    for path, html in built.pages.items():
        assert CANARY not in html, f"documents/ content leaked into {path}"


def test_load_published_records_filters_and_sorts(built: SimpleNamespace) -> None:
    published = load_published_records(built.root / "changes")
    assert [r["id"] for r in published] == [
        built.records[key]["id"]
        for key in ("script", "injection", "wholesale", "effdate", "negation")
    ]
    assert all(r["materiality"]["material"] for r in published)


# ------------------------------------------------------------ the change view


def claim_block(html: str, number: int) -> str:
    start = html.index(f'<li class="claim" id="claim-{number}">')
    return html[start : html.index("</li>", start)]


def test_each_claim_is_followed_by_the_hunks_it_cites(built: SimpleNamespace) -> None:
    """Direction D: the Claim and its evidence are one unit — every cited
    Hunk renders inside the Claim that first cites it, and every in-page
    link resolves."""
    for key in ("negation", "effdate", "wholesale"):
        html = change_page(built, key)
        bullets = built.records[key]["summary"]["bullets"]
        for number, bullet in enumerate(bullets, start=1):
            block = claim_block(html, number)
            for citation in bullet["citations"]:
                assert f'id="{citation["hunk"]}"' in block, (key, number, citation)
        for fragment in re.findall(r'href="#([^"]+)"', html):
            assert f'id="{fragment}"' in html, f"{key}: #{fragment} has no target"


def test_uncited_hunks_follow_in_document_order(built: SimpleNamespace) -> None:
    html = change_page(built, "wholesale")
    rest = html[html.index("The other 3 changed passages") :]
    assert [m for m in re.findall(r'<section class="hunk" id="(h\d+)"', rest)] == [
        "h1",
        "h5",
        "h6",
    ]


def test_diff_has_gutter_marks_and_hidden_labels(built: SimpleNamespace) -> None:
    html = change_page(built, "negation")
    assert '<span class="mk" aria-hidden="true">−</span><span class="sr">Removed:</span>' in html
    assert '<span class="mk" aria-hidden="true">+</span><span class="sr">Added:</span>' in html
    # Context lines render as .ln.cx, distinct from added/removed.
    assert 'class="ln cx"' in html


def test_change_view_header_and_facts(built: SimpleNamespace) -> None:
    html = change_page(built, "negation")
    assert 'class="crumb"' in html
    assert 'href="/companies/example/"' in html
    assert "<h1>Example changed its Privacy Policy</h1>" in html
    assert '<dl class="facts">' in html
    assert "97% of the text unchanged" in html  # similarity 0.97, as prose
    assert '<time datetime="2026-05-01">2026-05-01</time>' in html
    assert 'href="https://example.test/privacy"' in html  # source link


def test_effective_date_change_is_surfaced(built: SimpleNamespace) -> None:
    html = change_page(built, "effdate")
    date = '<span class="date">{}</span>'.format
    assert "<dt>Effective date</dt>" in html
    assert f"changed from {date('2025-01-01')} to {date('2026-03-15')}" in html
    # …and in the lists of entries, where the date change is the news.
    assert (
        f"Effective date changed: {date('2025-01-01')} → {date('2026-03-15')}"
        in built.pages["index.html"]
    )


def test_hunk_cited_several_times_renders_once(built: SimpleNamespace) -> None:
    """Three citations into h2 (two sides) render the passage once."""
    html = change_page(built, "wholesale")
    assert html.count('id="h2"') == 1
    assert 'id="h2"' in claim_block(html, 1)


def test_hunk_cited_by_several_claims_renders_under_the_first(tmp_path: Path) -> None:
    record = record_from_golden(
        "constructed-negation-sell-to-share", sha("a"), "2026-05-01T09:00:00Z"
    )
    bullet = record["summary"]["bullets"][0]
    record["summary"]["bullets"].append(
        {"text": "A second claim about the same passage.", "citations": bullet["citations"][1:]}
    )
    html = build_one(tmp_path, record)
    assert html.count('id="h1"') == 1
    assert 'id="h1"' in claim_block(html, 1)
    # The later Claim points back to where its evidence sits…
    assert 'href="#h1"' in claim_block(html, 2)
    # …and the passage names both Claims that cite it.
    assert 'href="#claim-1"' in html and 'href="#claim-2"' in html


def test_cited_quote_is_highlighted_inside_the_hunk(built: SimpleNamespace) -> None:
    html = change_page(built, "wholesale")
    # h3 is cited on its added side; "Delaware" is also a word mark, and the
    # two cues nest (highlight outside, mark inside) without merging.
    assert (
        '<mark class="q">governed by the laws of the State of <ins>Delaware</ins></mark>'
        in html
    )


def test_partial_coverage_note(built: SimpleNamespace) -> None:
    html = change_page(built, "wholesale")
    assert "covers 3 of 6 changed passages" in html
    # Full coverage renders no note.
    assert "changed passages;" not in change_page(built, "negation")


def test_missing_summary_renders_honest_state(built: SimpleNamespace) -> None:
    html = change_page(built, "injection")
    assert "No validated summary is available for this change" in html
    assert 'class="claims"' not in html
    assert '<mark class="q">' not in html


def test_hunk_text_is_data_never_markup(built: SimpleNamespace) -> None:
    # Hostile markup is escaped…
    html = change_page(built, "script")
    assert "<script" not in html
    assert "&lt;script&gt;" in html
    # …and prompt-injection prose is published verbatim as text (it is
    # evidence, not instructions).
    assert "ignore all previous instructions" in change_page(built, "injection")


# ---------------------------------------------------- word-level marks (#38)


def test_word_spans_for_an_aligned_replacement() -> None:
    removed = ["We sell your data to partners."]
    added = ["We share your data with partners."]
    assert site.word_spans(removed, added) == {
        "removed": [[0, [[3, 7], [18, 20]]]],
        "added": [[0, [[3, 8], [19, 23]]]],
    }


def test_word_spans_join_across_a_matching_space() -> None:
    """A changed phrase is one mark, not two words around an equal space."""
    assert site.word_spans(
        ["Last updated on April 15, 2026."], ["Last updated on August 25, 2026."]
    ) == {"removed": [[0, [[16, 24]]]], "added": [[0, [[16, 25]]]]}


def test_no_word_spans_for_a_rewritten_passage(built: SimpleNamespace) -> None:
    """Below 0.5 token similarity the sides are not aligned: no marks."""
    h2 = built.records["wholesale"]["hunks"][1]
    assert site.word_spans(h2["removed"], h2["added"]) is None
    html = change_page(built, "wholesale")
    section = html[html.index('id="h2"') : html.index("</section>", html.index('id="h2"'))]
    assert "<del>" not in section and "<ins>" not in section
    # One-sided hunks never get marks either.
    assert site.word_spans([], ["Only added."]) is None


def test_word_marks_render_inside_changed_lines(built: SimpleNamespace) -> None:
    html = change_page(built, "wholesale")
    section = html[html.index('id="h5"') : html.index("</section>", html.index('id="h5"'))]
    assert "<ins>one hundred dollars ($100) or</ins>" in section
    assert "<ins>, whichever is greater</ins>" in section


SPACING_HUNK = {
    "id": "h1",
    "old_start": 40,
    "new_start": 40,
    "context_before": [],
    "removed": ["and steps taken.", "specific Google services"],
    "added": ["and steps taken.specific Google services"],
    "context_after": [],
    "word_spans": None,
}


def test_spacing_only_difference_has_no_marks_and_says_so(tmp_path: Path) -> None:
    assert site.word_spans(SPACING_HUNK["removed"], SPACING_HUNK["added"]) is None
    record = base_record("example", "privacy", sha("7"), "2026-05-01T09:00:00Z", [SPACING_HUNK])
    html = build_one(tmp_path, record)
    assert "Only spacing or line breaks changed." in html
    assert "<del>" not in html and "<ins>" not in html


MARK_TAGS = re.compile(r'</?(?:del|ins)>|<mark class="q">|</mark>')


def test_marks_never_enter_the_text_a_citation_validates_against(
    built: SimpleNamespace,
) -> None:
    """Marks are presentation: the stored record keeps word_spans null and
    its lines untouched, every Citation still validates against the plain
    line on its Side, and each rendered line is exactly that plain line once
    the mark tags are removed."""
    from inplain.summarize import citation_is_valid

    for record in load_published_records(built.root / "changes"):
        original = built.records[
            next(k for k, r in built.records.items() if r["id"] == record["id"])
        ]
        assert record["hunks"] == original["hunks"]
        assert all(hunk["word_spans"] is None for hunk in record["hunks"])
        hunks = {hunk["id"]: hunk for hunk in record["hunks"]}
        for bullet in (record.get("summary") or {}).get("bullets", []):
            assert all(citation_is_valid(c, hunks) for c in bullet["citations"])
        page = built.pages[f"changes/{record['id']}/index.html"]
        rendered = [
            htmllib.unescape(MARK_TAGS.sub("", text))
            for text in re.findall(
                r'<div class="ln (?:rm|ad)">.*?<span class="tx">(.*?)</span></div>', page
            )
        ]
        expected = [
            line for hunk in record["hunks"] for line in hunk["removed"] + hunk["added"]
        ]
        assert sorted(rendered) == sorted(expected), record["id"]


# ------------------------------------------------------------------ the feeds


def test_home_is_the_change_feed(built: SimpleNamespace) -> None:
    html = built.pages["index.html"]
    for key in ("negation", "effdate", "wholesale", "injection", "script"):
        assert f"/changes/{built.records[key]['id']}/" in html
    # Dates and summary bullets appear in the feed.
    assert '<time datetime="2026-05-01">2026-05-01</time>' in html
    assert "narrower promise about" in html  # negation bullet text
    # Newest first.
    assert html.index(built.records["script"]["id"]) < html.index(
        built.records["negation"]["id"]
    )


def test_changes_index_lists_everything_with_company_filter_links(
    built: SimpleNamespace,
) -> None:
    html = built.pages["changes/index.html"]
    for key in ("negation", "effdate", "wholesale", "injection", "script"):
        assert f"/changes/{built.records[key]['id']}/" in html
    assert "<h1>All changes</h1>" in html
    # Filtering is plain links to static pages — URL-addressable state.
    assert 'aria-label="Filter by company"' in html
    assert 'href="/companies/example/"' in html
    assert 'href="/companies/other/"' in html


def test_company_page_documents_and_history(built: SimpleNamespace) -> None:
    html = built.pages["companies/example/index.html"]
    # Docs are the union of the catalog and the published records: privacy is
    # in the catalog, tos exists only via records.
    assert "Privacy Policy" in html
    assert "Terms of Service" in html
    for key in ("negation", "effdate", "wholesale", "injection"):
        assert built.records[key]["id"] in html
    assert built.records["script"]["id"] not in html  # other company's change
    counts = built.pages["companies/index.html"]
    assert re.search(r'href="/companies/example/">Example</a></th>\s*<td>.*?</td>\s*<td class="num">4</td>', counts)
    assert re.search(r'href="/companies/other/">Other Co</a></th>\s*<td>.*?</td>\s*<td class="num">1</td>', counts)


# ------------------------------------------------------- static, a11y, links


def test_no_script_and_content_is_static(built: SimpleNamespace) -> None:
    """AC-7: nothing essential (or at all) comes from JavaScript — the
    content is in the HTML."""
    for path, html in built.pages.items():
        assert "<script" not in html.lower(), f"{path} ships script"
    html = MARK_TAGS.sub("", change_page(built, "negation"))
    assert "We do not sell your personal information to third parties." in html


def test_accessibility_floor(built: SimpleNamespace) -> None:
    for path, html in built.pages.items():
        assert html.count("<h1") == 1, f"{path}: exactly one h1"
        assert '<html lang="en">' in html, f"{path}: lang attribute"
        assert 'class="skip"' in html, f"{path}: skip link"
        assert '<main id="main">' in html, f"{path}: main landmark"
        assert "<title>" in html and "</title>" in html, f"{path}: title"
        assert "<header" in html and "<footer" in html and "<nav" in html, path


def test_titles_are_per_page(built: SimpleNamespace) -> None:
    titles = {
        path: re.search(r"<title>([^<]+)</title>", html).group(1)
        for path, html in built.pages.items()
    }
    assert len(set(titles.values())) == len(titles)


def test_404_page_exists_and_stands_alone(built: SimpleNamespace) -> None:
    html = built.pages["404.html"]
    assert "Page not found" in html
    # Root-relative asset URLs: a 404 is served from arbitrary paths.
    assert 'href="/static/site.css"' in html
    for href in ('href="/"', 'href="/changes/"', 'href="/companies/"'):
        assert html.split("<main", 1)[1].count(href) >= 1, href


def test_share_metadata_is_text_only_and_on_every_page(built: SimpleNamespace) -> None:
    for path, html in built.pages.items():
        for tag in ('property="og:title"', 'property="og:description"',
                    'property="og:type"', 'name="twitter:card" content="summary"'):
            assert tag in html, (path, tag)
        assert "og:image" not in html and "twitter:image" not in html, path
        if path != "404.html":  # served from arbitrary paths: no canonical URL
            url = "https://inplain.ai/" + path.removesuffix("index.html")
            assert f'<meta property="og:url" content="{url}">' in html, path
            assert f'<link rel="canonical" href="{url}">' in html, path
    html = change_page(built, "negation")
    assert '<meta property="og:type" content="article">' in html
    assert '<meta property="article:published_time" content="2026-05-01T09:00:00Z">' in html
    # The first Claim is the description a share card shows.
    assert 'content="The flat promise not to sell personal information' in html
    assert '<meta property="og:type" content="website">' in built.pages["index.html"]


def test_no_dead_internal_links(built: SimpleNamespace) -> None:
    for path, html in built.pages.items():
        for href in HREF.findall(html):
            if not href.startswith("/"):
                assert href.startswith(("#", "https://", "http://")), (path, href)
                if href.startswith("#"):
                    assert f'id="{href[1:]}"' in html, (path, href)
                continue
            target, _, fragment = href.partition("#")
            file = built.out / target.lstrip("/")
            if target.endswith("/"):
                file = file / "index.html"
            assert file.is_file(), f"dead internal link {href} in {path}"
            if fragment:
                assert f'id="{fragment}"' in file.read_text(encoding="utf-8"), (
                    f"dead fragment {href} in {path}"
                )


# -------------------------------------------------------------- determinism


def test_rebuild_is_byte_identical(built: SimpleNamespace) -> None:
    out2 = built.root / "_site-second"
    build_site(
        catalog_path=built.root / "catalog.json",
        changes_dir=built.root / "changes",
        out_dir=out2,
    )
    first = {p.relative_to(built.out).as_posix(): p for p in built.out.rglob("*") if p.is_file()}
    second = {p.relative_to(out2).as_posix(): p for p in out2.rglob("*") if p.is_file()}
    assert set(first) == set(second)
    for rel in first:
        assert first[rel].read_bytes() == second[rel].read_bytes(), rel


def test_no_wall_clock_in_pages(built: SimpleNamespace) -> None:
    """Any 'generated' moment comes from the newest change record."""
    html = built.pages["index.html"]
    assert "latest 2026-08-05" in html  # the newest record's detected_at date


# ---------------------------------------------------------------------- CLI


def test_cli_builds_and_reports(tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
    write_inputs(tmp_path, make_records())
    code = site.main(
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
    assert "published=5 suppressed=1" in capsys.readouterr().out
    assert (tmp_path / "_site" / "index.html").is_file()


def test_invalid_record_fails_the_whole_build(
    tmp_path: Path, capsys: pytest.CaptureFixture
) -> None:
    """All-or-nothing: one bad record → exit 2 and NO output at all."""
    records = make_records()
    write_inputs(tmp_path, records)
    bad = dict(records["negation"])
    bad["id"] = "example-privacy-zzzzzzz"  # id does not match its commit
    path = tmp_path / "changes" / f"{bad['id']}.json"
    path.write_text(
        json.dumps(bad, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n"
    )
    out = tmp_path / "_site"
    code = site.main(
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
    assert not out.exists(), "a failed build must not publish a partial site"


def test_filename_id_mismatch_fails_the_build(tmp_path: Path) -> None:
    records = make_records()
    write_inputs(tmp_path, records)
    renamed = tmp_path / "changes" / "not-the-record-id.json"
    (tmp_path / "changes" / f"{records['negation']['id']}.json").rename(renamed)
    with pytest.raises(schema.SchemaError, match="filename"):
        build_site(
            catalog_path=tmp_path / "catalog.json",
            changes_dir=tmp_path / "changes",
            out_dir=tmp_path / "_site",
        )


def test_missing_changes_dir_builds_an_empty_site(tmp_path: Path) -> None:
    (tmp_path / "catalog.json").write_text(
        json.dumps(CATALOG), encoding="utf-8", newline="\n"
    )
    report = build_site(
        catalog_path=tmp_path / "catalog.json",
        changes_dir=tmp_path / "changes",
        out_dir=tmp_path / "_site",
    )
    assert report.published == 0
    html = (tmp_path / "_site" / "index.html").read_text(encoding="utf-8")
    assert "No policy has changed yet" in html


def test_empty_home_is_the_watch_record(tmp_path: Path) -> None:
    """The launch state is content: what is watched, since when (a fixed
    date, never the wall clock), and where the first change will appear."""
    (tmp_path / "catalog.json").write_text(json.dumps(CATALOG), encoding="utf-8")
    build_site(
        catalog_path=tmp_path / "catalog.json",
        changes_dir=tmp_path / "changes",
        out_dir=tmp_path / "_site",
    )
    html = (tmp_path / "_site" / "index.html").read_text(encoding="utf-8")
    assert "Watching 2 documents from 2 companies" in html
    assert f'<time datetime="{site.WATCH_SINCE}">' in html
    assert 'href="/feed.xml"' in html.split("<main", 1)[1]
    assert "nothing is backfilled" in html
    # The watched Documents, listed by Company.
    assert 'href="/companies/example/">Example</a>' in html
    assert "Privacy Policy" in html and "Terms of Service" in html
