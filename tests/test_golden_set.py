"""Golden-set integrity tests (R2, issue #30).

The load-bearing guarantee: every expected citation's quote appears VERBATIM
on the named side of the named hunk (SPEC AC-3). No network is touched — the
golden set is on disk.
"""

import json
from pathlib import Path

import pytest

from run_eval import GOLDEN_DIR, load_golden

ENTRY_KEYS = {"id", "source", "company", "doc", "hunks", "expected", "notes"}
HUNK_KEYS = {
    "id", "old_start", "new_start", "context_before", "removed", "added",
    "context_after", "word_spans",
}
SOURCES = {"real-diff", "wayback", "constructed"}


def entries():
    return load_golden()


def all_citations():
    out = []
    for entry in entries():
        hunks_by_id = {h["id"]: h for h in entry["hunks"]}
        for bullet in entry["expected"]["bullets"]:
            for citation in bullet["citations"]:
                out.append((entry["id"], hunks_by_id, citation))
    return out


def test_golden_dir_exists_and_size():
    assert GOLDEN_DIR.is_dir()
    n = len(entries())
    assert 15 <= n <= 20, f"golden set must hold 15-20 entries, found {n}"


def test_entry_ids_unique_and_match_filenames():
    ids = [e["id"] for e in entries()]
    assert len(ids) == len(set(ids))
    on_disk = {p.stem for p in Path(GOLDEN_DIR).glob("*.json")}
    assert set(ids) == on_disk


@pytest.mark.parametrize("entry", entries(), ids=lambda e: e["id"])
def test_entry_shape(entry):
    assert set(entry) == ENTRY_KEYS
    assert entry["source"] in SOURCES
    assert isinstance(entry["company"], str) and entry["company"]
    assert isinstance(entry["doc"], str) and entry["doc"]
    assert isinstance(entry["notes"], str) and entry["notes"]
    assert entry["hunks"], "entry must contain at least one hunk"
    assert entry["expected"]["bullets"], "entry must expect at least one bullet"


@pytest.mark.parametrize("entry", entries(), ids=lambda e: e["id"])
def test_hunks_match_normative_schema(entry):
    """Hunk objects follow docs/decisions/G1-word-level-highlighting.md."""
    seen = set()
    for hunk in entry["hunks"]:
        assert set(hunk) == HUNK_KEYS, f"{entry['id']}/{hunk.get('id')}"
        assert hunk["id"] not in seen
        seen.add(hunk["id"])
        assert isinstance(hunk["old_start"], int) and hunk["old_start"] >= 1
        assert isinstance(hunk["new_start"], int) and hunk["new_start"] >= 1
        for key in ("context_before", "removed", "added", "context_after"):
            assert isinstance(hunk[key], list)
            assert all(isinstance(line, str) for line in hunk[key])
        assert len(hunk["context_before"]) <= 3
        assert len(hunk["context_after"]) <= 3
        assert hunk["removed"] or hunk["added"], "a hunk must change something"
        assert hunk["word_spans"] is None, "word_spans is reserved, null in v1"


@pytest.mark.parametrize("entry", entries(), ids=lambda e: e["id"])
def test_every_bullet_has_a_citation(entry):
    for bullet in entry["expected"]["bullets"]:
        assert isinstance(bullet["text"], str) and bullet["text"].strip()
        assert bullet["citations"], f"bullet without citations in {entry['id']}"


@pytest.mark.parametrize(
    "entry_id,hunks_by_id,citation",
    all_citations(),
    ids=lambda v: v if isinstance(v, str) else "",
)
def test_citation_quote_verbatim_on_named_side(entry_id, hunks_by_id, citation):
    """AC-3 for the golden set itself: quote appears VERBATIM (exact, not
    merely tolerant) on the named side of the named hunk."""
    assert citation["hunk"] in hunks_by_id, f"{entry_id}: unknown hunk"
    assert citation["side"] in ("added", "removed"), f"{entry_id}: bad side"
    hunk = hunks_by_id[citation["hunk"]]
    haystack = "\n".join(hunk[citation["side"]])
    assert citation["quote"], f"{entry_id}: empty quote"
    assert citation["quote"] in haystack, (
        f"{entry_id}: quote not verbatim on {citation['side']} of "
        f"{citation['hunk']}: {citation['quote'][:80]!r}"
    )


def test_required_discriminating_cases_present():
    by_id = {e["id"]: e for e in entries()}
    assert "real-google-privacy-2026-04" in by_id
    assert by_id["real-google-privacy-2026-04"]["source"] == "real-diff"
    assert len(by_id["real-google-privacy-2026-04"]["hunks"]) == 18
    sources = [e["source"] for e in entries()]
    assert sources.count("wayback") >= 3
    assert sources.count("constructed") >= 6
    for required in (
        "constructed-negation-sell-to-share",
        "constructed-negation-opt-out-flip",
        "constructed-number-retention-24-to-12",
        "constructed-effective-date-only",
        "constructed-small-insert-huge-doc",
        "constructed-wholesale-rewrite-partial",
        "constructed-prompt-injection-in-hunk",
    ):
        assert required in by_id, f"missing discriminating case {required}"


def test_injection_entry_contains_injection_text():
    entry = next(e for e in entries() if e["id"] == "constructed-prompt-injection-in-hunk")
    added = "\n".join(line for h in entry["hunks"] for line in h["added"])
    assert "ignore all previous instructions" in added.casefold()


def test_golden_files_are_valid_json_with_utf8():
    for path in Path(GOLDEN_DIR).glob("*.json"):
        with open(path, encoding="utf-8") as fh:
            json.load(fh)
