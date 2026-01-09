from inplain.worker.summarize_pipeline import (
    SummaryV1,
    _ensure_disclaimer,
    _validate_citations,
)


def test_validate_citations_keeps_valid_quotes() -> None:
    hunks = [
        {
            "hunkId": "h1",
            "context": "Sharing",
            "added": ["We may share information with analytics providers."],
            "removed": [],
        }
    ]
    summary = SummaryV1.model_validate(
        {
            "what_changed": [
                {
                    "text": "Added language about sharing with analytics providers.",
                    "citations": [
                        {
                            "hunkId": "h1",
                            "quote": "analytics providers",
                            "side": "added",
                        }
                    ],
                }
            ],
            "why_it_matters": [],
            "disclaimer": "This summary is informational and not legal advice.",
        }
    )

    validated = _validate_citations(summary, hunks)
    assert validated.what_changed[0].citation_invalid is False
    assert len(validated.what_changed[0].citations) == 1


def test_validate_citations_flags_invalid_quotes() -> None:
    hunks = [
        {
            "hunkId": "h1",
            "context": "Sharing",
            "added": ["We may share information with analytics providers."],
            "removed": [],
        }
    ]
    summary = SummaryV1.model_validate(
        {
            "what_changed": [
                {
                    "text": "Added language about sharing with analytics providers.",
                    "citations": [
                        {
                            "hunkId": "h1",
                            "quote": "does not exist",
                            "side": "added",
                        }
                    ],
                }
            ],
            "why_it_matters": [],
            "disclaimer": "This summary is informational and not legal advice.",
        }
    )

    validated = _validate_citations(summary, hunks)
    assert validated.what_changed[0].citation_invalid is True
    assert validated.what_changed[0].citations == []


def test_ensure_disclaimer() -> None:
    assert _ensure_disclaimer("This summary is informational and not legal advice.")
    assert _ensure_disclaimer("Not legal advice.")

