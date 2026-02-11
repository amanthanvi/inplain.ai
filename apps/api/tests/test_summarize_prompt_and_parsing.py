from __future__ import annotations


def test_summarize_prompt_is_length_capped() -> None:
    from inplain.worker.handlers import summarize as summarize_handler

    huge = "A" * 200_000
    hunks = [
        {
            "hunkId": "h1",
            "contextBefore": "",
            "contextAfter": "",
            "added": [huge],
            "removed": [huge],
        }
        for _ in range(50)
    ]

    prompt = summarize_handler._build_prompt(diff_hunks=hunks)
    assert len(prompt) <= summarize_handler._MAX_PROMPT_CHARS


def test_summarize_parses_json_from_code_fence() -> None:
    from inplain.worker.handlers import summarize as summarize_handler

    payload = """```json
{"what_changed":[{"text":"x","citations":[{"hunkId":"h1","quote":"q"}]}],"why_matters":[]}
```"""
    parsed = summarize_handler._parse_json_object(payload)
    assert parsed["what_changed"][0]["text"] == "x"

