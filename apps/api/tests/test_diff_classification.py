from __future__ import annotations

from inplain.db.models.enums import DiffClassification
from inplain.worker.handlers.diff import _classify_change, _is_ambiguous_change


def test_classify_change_major_by_score() -> None:
    out = _classify_change(change_score=0.2, changed_chars=10)
    assert out == DiffClassification.major


def test_classify_change_meaningful_by_score() -> None:
    out = _classify_change(change_score=0.05, changed_chars=10)
    assert out == DiffClassification.meaningful


def test_classify_change_meaningful_by_changed_chars() -> None:
    out = _classify_change(change_score=0.01, changed_chars=500)
    assert out == DiffClassification.meaningful


def test_is_ambiguous_change_true() -> None:
    assert _is_ambiguous_change(change_score=0.03, changed_chars=1000) is True


def test_is_ambiguous_change_false_when_score_high() -> None:
    assert _is_ambiguous_change(change_score=0.12, changed_chars=1000) is False


def test_is_ambiguous_change_false_when_changed_chars_high() -> None:
    assert _is_ambiguous_change(change_score=0.03, changed_chars=10_000) is False

