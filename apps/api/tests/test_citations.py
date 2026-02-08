from __future__ import annotations

import pytest

from inplain.worker.handlers.summarize import _validate_citations


def test_validate_citations_accepts_exact_substring() -> None:
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

    _validate_citations(diff_hunks=diff_hunks, bullets=bullets)


def test_validate_citations_rejects_missing_quote() -> None:
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

    with pytest.raises(ValueError, match="invalid quote"):
        _validate_citations(diff_hunks=diff_hunks, bullets=bullets)

