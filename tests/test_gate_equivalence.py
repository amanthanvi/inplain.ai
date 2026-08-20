"""The eval harness's citation gate and the production gate must agree.

eval/run_eval.py scores models against the same rule inplain/summarize.py
publishes with. The implementations are deliberately separate files; this
test pins them to identical behavior so an edit to one cannot silently
desynchronize the measured pass rate from the production gate.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

import run_eval  # via the eval/ sys.path entry in conftest.py
from inplain import summarize

HUNK = {
    "id": "h1",
    "old_start": 1,
    "new_start": 1,
    "context_before": ["Before context."],
    "removed": ["We will never sell your personal information.", "You may opt out."],
    "added": ["We may share your personal information.", "You may not opt out."],
    "context_after": ["After context."],
    "word_spans": None,
}
HUNKS = {"h1": HUNK}

CASES = [
    # exact match on the right side
    {"hunk": "h1", "side": "added", "quote": "We may share your personal information."},
    {"hunk": "h1", "side": "removed", "quote": "You may opt out."},
    # whitespace / case tolerance
    {"hunk": "h1", "side": "added", "quote": "we  may   share your personal information."},
    {"hunk": "h1", "side": "removed", "quote": "YOU MAY OPT OUT."},
    # the v0.2.0 defect shapes: wrong side, negation flip, paraphrase
    {"hunk": "h1", "side": "added", "quote": "We will never sell your personal information."},
    {"hunk": "h1", "side": "removed", "quote": "You may not opt out."},
    {"hunk": "h1", "side": "added", "quote": "We might share some of your data."},
    # structural garbage
    {"hunk": "h9", "side": "added", "quote": "We may share your personal information."},
    {"hunk": "h1", "side": "context", "quote": "Before context."},
    {"hunk": "h1", "side": "added", "quote": ""},
    {"hunk": "h1", "side": "added", "quote": "   "},
    {"hunk": "h1", "side": "added", "quote": None},
    {"hunk": None, "side": "added", "quote": "We may share your personal information."},
    # substring across line boundaries within one side
    {"hunk": "h1", "side": "added", "quote": "information.\nYou may not opt out."},
]


@pytest.mark.parametrize("citation", CASES, ids=lambda c: repr(c)[:70])
def test_eval_gate_matches_production_gate(citation):
    assert run_eval.citation_is_valid(citation, HUNKS) == summarize.citation_is_valid(
        citation, HUNKS
    )


def test_gates_agree_on_every_golden_expected_citation():
    golden = sorted((Path(__file__).resolve().parents[1] / "eval" / "golden").glob("*.json"))
    assert golden, "golden set must exist"
    compared = 0
    for path in golden:
        entry = json.loads(path.read_text(encoding="utf-8"))
        hunks = {h["id"]: h for h in entry["hunks"]}
        for bullet in entry["expected"]["bullets"]:
            for citation in bullet["citations"]:
                assert run_eval.citation_is_valid(
                    citation, hunks
                ) == summarize.citation_is_valid(citation, hunks), (
                    f"{path.name}: gates disagree on {citation!r}"
                )
                compared += 1
    assert compared > 0
