from __future__ import annotations

import pytest

from inplain.worker.handlers.summarize import _validate_citations


def test_validate_citations_marks_exact_matches_valid() -> None:
    diff_hunks = [
        {
            "hunkId": "h1",
            "contextBefore": "before ",
            "contextAfter": " after",
            "added": ["hello world"],
            "removed": ["goodbye"],
        }
    ]

    bullets = [
        {"text": "Something changed", "citations": [{"hunkId": "h1", "quote": "hello world"}]},
        {"text": "Why it matters", "citations": [{"hunkId": "h1", "quote": "goodbye"}]},
    ]

    validated = _validate_citations(diff_hunks=diff_hunks, bullets=bullets)
    statuses = [c["status"] for b in validated for c in b["citations"]]
    assert statuses == ["valid", "valid"]


def test_validate_citations_repairs_partial_quotes() -> None:
    diff_hunks = [
        {
            "hunkId": "h1",
            "contextBefore": "",
            "contextAfter": "",
            "added": ["We share data with service providers for fraud prevention."],
            "removed": [],
        }
    ]

    bullets = [
        {
            "text": "Repairable quote",
            "citations": [
                {"hunkId": "h1", "quote": "share  data with service providers for fraud prevention"}
            ],
        }
    ]

    validated = _validate_citations(diff_hunks=diff_hunks, bullets=bullets)
    citation = validated[0]["citations"][0]
    assert citation["status"] == "repaired"
    assert citation["quote"] == "We share data with service providers for fraud prevention."


def test_validate_citations_marks_unrepairable_quotes_unverified() -> None:
    diff_hunks = [
        {
            "hunkId": "h1",
            "contextBefore": "",
            "contextAfter": "",
            "added": ["hello world"],
            "removed": [],
        }
    ]

    bullets = [{"text": "Bad cite", "citations": [{"hunkId": "h1", "quote": "not present"}]}]
    validated = _validate_citations(diff_hunks=diff_hunks, bullets=bullets)
    assert validated[0]["citations"][0]["status"] == "unverified"


def test_validate_citations_rejects_missing_citations() -> None:
    diff_hunks = [
        {
            "hunkId": "h1",
            "contextBefore": "",
            "contextAfter": "",
            "added": ["hello world"],
            "removed": [],
        }
    ]
    bullets = [{"text": "Bad cite", "citations": []}]
    with pytest.raises(ValueError, match="missing citations"):
        _validate_citations(diff_hunks=diff_hunks, bullets=bullets)
