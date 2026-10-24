"""Unit tests for the eval harness scoring logic (eval/run_eval.py).

No network. The scoring functions are pure; the golden expectations must
score 100% citation validity and 0% claim drop (the harness self-test).
"""

import pytest

from run_eval import (
    Aggregate,
    citation_is_valid,
    load_golden,
    normalize,
    parse_bullets,
    score_bullets,
)

HUNK = {
    "id": "h1",
    "old_start": 10,
    "new_start": 10,
    "context_before": [],
    "removed": ["You may not opt out of receiving these communications."],
    "added": ["You may opt out of receiving these communications at any time."],
    "context_after": [],
    "word_spans": None,
}
HUNKS = {"h1": HUNK}


def cite(hunk="h1", side="added", quote=""):
    return {"hunk": hunk, "side": side, "quote": quote}


class TestNormalize:
    def test_collapses_whitespace_and_case(self):
        assert normalize("  We\tRetain \n data ") == "we retain data"

    def test_no_other_transformation(self):
        # punctuation and unicode stay significant — tolerance is ONLY
        # whitespace and case (SPEC section 3)
        assert normalize("don’t") != normalize("don't")
        assert normalize("24 months") != normalize("12 months")


class TestCitationIsValid:
    def test_exact_match_added_side(self):
        assert citation_is_valid(
            cite(quote="You may opt out of receiving these communications"), HUNKS
        )

    def test_exact_match_removed_side(self):
        assert citation_is_valid(
            cite(side="removed", quote="You may not opt out"), HUNKS
        )

    def test_whitespace_and_case_tolerant(self):
        assert citation_is_valid(
            cite(quote="you  MAY opt\nout of receiving these communications"), HUNKS
        )

    def test_wrong_side_fails_even_when_other_side_matches(self):
        # the removed text exists — but the citation names "added"
        assert not citation_is_valid(
            cite(side="added", quote="You may not opt out"), HUNKS
        )

    def test_negation_flip_is_not_cross_matched(self):
        assert not citation_is_valid(
            cite(side="removed", quote="You may opt out of receiving these communications at any time"),
            HUNKS,
        )

    def test_near_miss_paraphrase_fails(self):
        # no fuzzy matching at any threshold
        assert not citation_is_valid(
            cite(quote="You can opt out of receiving these communications"), HUNKS
        )

    def test_unknown_hunk_fails(self):
        assert not citation_is_valid(cite(hunk="h99", quote="opt out"), HUNKS)

    def test_invalid_side_fails(self):
        assert not citation_is_valid(cite(side="both", quote="opt out"), HUNKS)

    def test_empty_or_missing_quote_fails(self):
        assert not citation_is_valid(cite(quote=""), HUNKS)
        assert not citation_is_valid(cite(quote="   "), HUNKS)
        assert not citation_is_valid({"hunk": "h1", "side": "added"}, HUNKS)

    def test_non_string_quote_fails(self):
        assert not citation_is_valid(cite(quote=42), HUNKS)

    def test_quote_spanning_lines_on_one_side(self):
        hunk = dict(HUNK, added=["First added line.", "Second added line."])
        assert citation_is_valid(
            cite(quote="First added line.\nSecond added line."), {"h1": hunk}
        )


class TestScoreBullets:
    def test_all_valid_bullets_kept(self):
        bullets = [
            {"text": "a", "citations": [cite(quote="opt out of receiving")]},
            {"text": "b", "citations": [cite(side="removed", quote="may not opt out")]},
        ]
        score = score_bullets(bullets, [HUNK], "e1")
        assert score.kept_bullets == 2
        assert score.valid_citations == 2
        assert score.covered_hunks == 1

    def test_bullet_with_any_invalid_citation_is_dropped(self):
        bullets = [{
            "text": "a",
            "citations": [
                cite(quote="opt out of receiving"),
                cite(quote="totally invented quote"),
            ],
        }]
        score = score_bullets(bullets, [HUNK], "e1")
        assert score.kept_bullets == 0
        assert score.dropped_bullets == 1
        assert score.valid_citations == 1
        assert score.total_citations == 2
        assert score.covered_hunks == 0

    def test_bullet_without_citations_is_dropped(self):
        score = score_bullets([{"text": "a", "citations": []}], [HUNK], "e1")
        assert score.kept_bullets == 0
        assert score.dropped_bullets == 1

    def test_coverage_counts_distinct_hunks_of_kept_bullets_only(self):
        h2 = dict(HUNK, id="h2", added=["Another added sentence entirely."])
        bullets = [
            {"text": "a", "citations": [cite(quote="opt out of receiving")]},
            {"text": "b", "citations": [cite(hunk="h2", quote="nope, invalid")]},
        ]
        score = score_bullets(bullets, [HUNK, h2], "e1")
        assert score.total_hunks == 2
        assert score.covered_hunks == 1


class TestAggregate:
    def test_rates(self):
        agg = Aggregate()
        s1 = score_bullets(
            [{"text": "a", "citations": [cite(quote="opt out of receiving")]}],
            [HUNK], "e1",
        )
        s2 = score_bullets(
            [{"text": "b", "citations": [cite(quote="invented")]}], [HUNK], "e2",
        )
        agg.add(s1)
        agg.add(s2)
        assert agg.citation_validity_rate == pytest.approx(0.5)
        assert agg.claim_drop_rate == pytest.approx(0.5)
        assert agg.mean_coverage == pytest.approx(0.5)

    def test_empty_aggregate_is_worst_case_not_crash(self):
        agg = Aggregate()
        assert agg.citation_validity_rate == 0.0
        assert agg.claim_drop_rate == 1.0
        assert agg.mean_coverage == 0.0


class TestParseBullets:
    def test_strict_json(self):
        raw = '{"bullets": [{"text": "t", "citations": []}]}'
        assert parse_bullets(raw) == [{"text": "t", "citations": []}]

    def test_json_wrapped_in_prose(self):
        raw = 'Here you go:\n{"bullets": []}\nHope that helps!'
        assert parse_bullets(raw) == []

    def test_garbage_returns_none(self):
        assert parse_bullets("COMPLIANT") is None
        assert parse_bullets("") is None
        assert parse_bullets('{"not_bullets": 1}') is None
        assert parse_bullets('{"bullets": "not a list"}') is None


class TestSelfTestAgainstGolden:
    """The harness self-test: golden expected bullets, scored as if a model
    produced them, must be perfect. This is the same check as
    `python eval/run_eval.py --self-test`."""

    def test_expected_bullets_score_perfectly(self):
        agg = Aggregate()
        for entry in load_golden():
            agg.add(score_bullets(entry["expected"]["bullets"], entry["hunks"], entry["id"]))
        assert agg.citation_validity_rate == 1.0
        assert agg.claim_drop_rate == 0.0
        assert agg.mean_coverage > 0.5

    def test_load_golden_limit(self):
        assert len(load_golden(limit=3)) == 3


class TestHunkizer:
    """The diff helper's pure logic (no network paths imported)."""

    def test_hunks_from_texts_shapes(self):
        from wayback_diff import hunks_from_texts

        old = "alpha\nbravo\ncharlie\ndelta\necho\n"
        new = "alpha\nbravo\nCHANGED charlie\ndelta\necho\nfoxtrot\n"
        hunks = hunks_from_texts(old, new)
        assert [h["id"] for h in hunks] == ["h1", "h2"]
        first = hunks[0]
        assert first["old_start"] == 3
        assert first["new_start"] == 3
        assert first["removed"] == ["charlie"]
        assert first["added"] == ["CHANGED charlie"]
        assert first["context_before"] == ["alpha", "bravo"]
        assert first["context_after"] == ["delta", "echo"]
        assert first["word_spans"] is None
        second = hunks[1]
        assert second["removed"] == []
        assert second["added"] == ["foxtrot"]

    def test_context_capped_at_three_lines(self):
        from wayback_diff import hunks_from_texts

        old = "\n".join(f"line {i}" for i in range(10))
        new = old + "\nnew tail"
        (hunk,) = hunks_from_texts(old, new)
        assert len(hunk["context_before"]) == 3

    def test_context_stops_at_the_neighbouring_hunk(self):
        from wayback_diff import hunks_from_texts

        first, second = hunks_from_texts("A\nB removed\nC\nD will change\nE", "A\nB2\nC\nD2\nE")
        assert (first["context_before"], first["context_after"]) == (["A"], ["C"])
        assert (second["context_before"], second["context_after"]) == (["C"], ["E"])
