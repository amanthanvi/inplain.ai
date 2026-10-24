"""Unit tests for the eval harness scoring logic (eval/run_eval.py).

No network. The harness counts with production's gate
(inplain.summarize.review_bullets and citation_is_valid, tested in
tests/test_summarize.py); these tests pin how it counts. The golden
expectations must score 100% citation validity and 0% claim drop (the
harness self-test).
"""

import pytest

from run_eval import Aggregate, load_golden, score_bullets

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


def cite(hunk="h1", side="added", quote=""):
    return {"hunk": hunk, "side": side, "quote": quote}


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

    def test_a_non_object_bullet_drops_alone_as_production_drops_it(self):
        bullets = ["not an object", {"text": "a", "citations": [cite(quote="opt out")]}]
        score = score_bullets(bullets, [HUNK], "e1")
        assert (score.total_bullets, score.kept_bullets) == (2, 1)
        assert (score.total_citations, score.valid_citations) == (1, 1)
        assert not score.parse_failure

    def test_a_bullet_without_text_is_dropped_but_its_quote_still_counts(self):
        bullets = [{"text": " ", "citations": [cite(quote="opt out")]}]
        score = score_bullets(bullets, [HUNK], "e1")
        assert score.kept_bullets == 0
        assert (score.total_citations, score.valid_citations) == (1, 1)

    def test_a_hunk_the_model_was_not_shown_is_not_evidence_but_counts_as_uncovered(self):
        h2 = dict(HUNK, id="h2")
        bullets = [{"text": "a", "citations": [cite(hunk="h2", quote="opt out")]}]
        score = score_bullets(bullets, [HUNK], "e1", total_hunks=2)
        assert score.valid_citations == 0
        assert score.kept_bullets == 0
        assert (score.covered_hunks, score.total_hunks) == (0, 2)
        assert score_bullets(bullets, [HUNK, h2], "e1").kept_bullets == 1


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

