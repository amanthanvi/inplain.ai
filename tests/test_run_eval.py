"""The eval harness's request method and results files (eval/run_eval.py).

No network: the HTTP call is injected into ``call_model``/``run_model`` as
``post`` and returns real ``requests.Response`` objects, the way
tests/test_summarize.py drives OpenRouterClient.
"""

from __future__ import annotations

import json

import pytest
import requests

import run_eval  # via the eval/ sys.path entry in conftest.py
from inplain import summarize


def http_response(payload=None, status=200) -> requests.Response:
    response = requests.Response()
    response.status_code = status
    response.reason = "Test"
    response._content = json.dumps(payload or {}).encode("utf-8")
    response.headers["Content-Type"] = "application/json"
    return response


def completion(content='{"bullets": []}', provider="google-ai-studio") -> dict:
    return {
        "provider": provider,
        "choices": [{"message": {"content": content}, "finish_reason": "stop"}],
        "usage": {
            "prompt_tokens": 900,
            "completion_tokens": 400,
            "completion_tokens_details": {"reasoning_tokens": 250},
        },
    }


def scripted(*items):
    """A fake ``post`` that answers with each item in turn (the last one
    repeats) and records every payload it was sent."""
    sent = []

    def post(url, headers=None, json=None, timeout=None):
        sent.append(json)
        item = items[min(len(sent) - 1, len(items) - 1)]
        if isinstance(item, Exception):
            raise item
        return item

    post.sent = sent
    return post


@pytest.fixture(autouse=True)
def no_backoff(monkeypatch):
    monkeypatch.setattr(run_eval, "RETRY_BACKOFF", (0, 0, 0))


def call(model, post):
    return run_eval.call_model("openrouter", "test-key", model, "prompt", post)


PINNED = {"order": ["google-ai-studio"], "allow_fallbacks": False, "data_collection": "deny"}


def test_pinned_model_gets_the_system_prompt_temperature_zero_and_no_fallbacks():
    post = scripted(http_response(completion()))
    call("google/gemini-3.7-flash", post)
    (payload,) = post.sent
    assert payload["messages"] == [
        {"role": "system", "content": summarize.SYSTEM_PROMPT},
        {"role": "user", "content": "prompt"},
    ]
    assert payload["temperature"] == 0
    assert payload["max_tokens"] == summarize.MAX_OUTPUT_TOKENS
    assert payload["provider"] == PINNED
    assert "require_parameters" not in json.dumps(payload)
    assert "service_tier" not in payload


@pytest.mark.parametrize("model", [summarize.DEFAULT_MODEL, summarize.FALLBACK_MODEL])
def test_the_shipped_models_are_measured_with_exactly_the_request_production_sends(model):
    calls = []

    def post(url, headers=None, json=None, timeout=None):
        calls.append((url, headers, json, timeout))
        return http_response(completion())

    run_eval.call_model("openrouter", "test-key", model, "the user turn", post)
    summarize.OpenRouterClient("test-key", post=post).complete(
        model, summarize.SYSTEM_PROMPT, "the user turn"
    )
    measured, shipped = calls
    assert measured == shipped


def test_each_entry_is_sent_as_production_sends_the_record():
    (entry,) = [e for e in run_eval.load_golden() if e["id"].startswith("stripe-")]
    prompt, shown = run_eval.production_prompt(entry, run_eval.company_names())
    # the Hunk budget sends a prefix and says so, as Summarizer does
    assert shown == summarize.select_hunks(entry["hunks"])
    assert 0 < len(shown) < len(entry["hunks"])
    assert f"you have been given the first {len(shown)}" in prompt
    assert "Company: Stripe\n" in prompt
    assert "-----BEGIN QUOTED DOCUMENT DATA " in prompt
    assert entry["hunks"][len(shown)]["added"][0] not in prompt


@pytest.mark.parametrize("model", ["openai/gpt-6-luna", "anthropic/claude-sonnet-5"])
def test_models_that_reject_sampling_get_no_temperature(model):
    post = scripted(http_response(completion()))
    call(model, post)
    (payload,) = post.sent
    assert "temperature" not in payload
    assert payload["provider"]["order"] == [run_eval.PROVIDER_PINS[model]]


def test_unpinned_model_runs_unpinned_with_a_warning(capsys):
    post = scripted(http_response(completion()))
    entries = run_eval.load_golden(limit=1)
    run_eval.run_model(entries, "openrouter", "test-key", "vendor/unlisted", post)
    assert "provider" not in post.sent[0]
    assert "WARNING: vendor/unlisted has no provider pin" in capsys.readouterr().out


def test_408_429_5xx_timeouts_and_dropped_connections_are_retried_three_times():
    post = scripted(
        http_response(status=429),
        http_response(status=503),
        requests.exceptions.Timeout("slow"),
        http_response(completion()),
    )
    result = call("google/gemini-3.8-flash", post)
    assert result["reply"] == '{"bullets": []}'
    assert result["attempts"] == len(post.sent) == 4

    post = scripted(
        http_response(status=408),
        requests.exceptions.ConnectionError("read timed out"),
        http_response(completion()),
    )
    assert call("google/gemini-3.8-flash", post)["attempts"] == 3

    exhausted = scripted(http_response(status=502))
    with pytest.raises(run_eval.CallFailed, match="gave up after 3 retries"):
        call("google/gemini-3.8-flash", exhausted)
    assert len(exhausted.sent) == 4

    refused = scripted(http_response(status=404))
    with pytest.raises(run_eval.CallFailed, match="HTTP 404"):
        call("google/gemini-3.8-flash", refused)
    assert len(refused.sent) == 1

    with pytest.raises(SystemExit, match="HTTP 402"):
        call("google/gemini-3.8-flash", scripted(http_response(status=402)))


def test_each_call_records_served_provider_and_usage():
    result = call("qwen/qwen3.8-flash", scripted(http_response(completion(provider="alibaba"))))
    assert result["served_provider"] == "alibaba"
    assert result["finish_reason"] == "stop"
    assert run_eval.usage_figures(result["usage"]) == (900, 400, 250)


def test_each_pass_gets_its_own_file_and_the_aggregate_spans_them(tmp_path):
    entries = run_eval.load_golden(limit=2)
    good = entries[0]["expected"]
    for number in (1, 2):
        calls = run_eval.run_model(
            entries, "openrouter", "test-key", "google/gemini-3.7-flash",
            scripted(http_response(completion(json.dumps(good)))),
        )
        run_eval.record_pass(tmp_path, number, "openrouter", "google/gemini-3.7-flash", calls)

    for number in (1, 2):
        recorded = json.loads((tmp_path / f"pass{number}.json").read_text())
        result = recorded["models"]["google/gemini-3.7-flash"]
        assert [c["entry"] for c in result["calls"]] == [e["id"] for e in entries]
        assert result["calls"][0]["served_provider"] == "google-ai-studio"
        assert result["request"]["provider"] == PINNED
        assert result["calls"][0]["shown_hunks"] == len(entries[0]["hunks"])
    aggregate = json.loads((tmp_path / "aggregate.json").read_text())
    assert aggregate["passes"] == {
        "1": ["google/gemini-3.7-flash"], "2": ["google/gemini-3.7-flash"]
    }
    (row,) = aggregate["aggregate"]
    assert row["runs"] == 2
    assert row["entries"] == 4
    assert row["mean_reasoning_tokens"] == 250


@pytest.mark.parametrize("key", ["sk-secret\r", "sk-sec\nret"])
def test_the_key_never_reaches_an_error_or_the_results(key):
    # requests repeats a rejected header value, key included, in its error
    def post(url, headers=None, json=None, timeout=None):
        raise requests.exceptions.InvalidHeader(
            f"Invalid leading whitespace in header value: {headers['Authorization']!r}"
        )

    with pytest.raises(run_eval.CallFailed) as info:
        run_eval.call_model("openrouter", key, "x-ai/grok-4.7", "p", post)
    assert "sk-sec" not in str(info.value)
    assert "[key]" in str(info.value)


def test_a_wrong_typed_hunk_id_drops_its_claim_alone_as_in_production():
    entries = run_eval.load_golden(limit=1)
    reply = '{"bullets": [{"text": "t", "citations": [{"hunk": ["h1"], "side": "added", "quote": "q"}]}]}'
    post = scripted(http_response(completion(reply)))
    (record,) = run_eval.run_model(entries, "openrouter", "k", "x-ai/grok-4.7", post)
    assert not record["score"]["parse_failure"]
    assert record["score"]["total_citations"] == 1
    assert record["score"]["valid_citations"] == record["score"]["kept_bullets"] == 0


def test_a_reply_the_gate_raises_on_loses_every_claim_not_the_run(monkeypatch):
    def raises(bullets, hunks):
        raise TypeError("unwalkable")

    monkeypatch.setattr(run_eval.summarize, "review_bullets", raises)
    entries = run_eval.load_golden(limit=1)
    post = scripted(http_response(completion('{"bullets": []}')))
    (record,) = run_eval.run_model(entries, "openrouter", "k", "x-ai/grok-4.7", post)
    assert record["score"]["parse_failure"]
    assert record["malformed"] == "unwalkable"


def test_a_non_object_bullet_drops_alone_as_in_production():
    entries = run_eval.load_golden(limit=1)
    post = scripted(http_response(completion('{"bullets": ["not an object"]}')))
    (record,) = run_eval.run_model(entries, "openrouter", "k", "x-ai/grok-4.7", post)
    assert not record["score"]["parse_failure"]
    assert (record["score"]["total_bullets"], record["score"]["kept_bullets"]) == (1, 0)


def test_a_results_directory_of_another_method_is_refused_before_any_call(
    tmp_path, monkeypatch
):
    run_eval.write_json(
        tmp_path / "pass1.json", {"pass": 1, "method": "the September prompt", "models": {}}
    )
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    monkeypatch.setattr(run_eval, "run_model", lambda *a, **k: pytest.fail("no call"))
    with pytest.raises(SystemExit, match="another method"):
        run_eval.main(
            ["--provider", "openrouter", "--out", str(tmp_path), "--pass", "2",
             "--model", "x-ai/grok-4.7"]
        )


def test_an_anthropic_record_stores_no_prompt(tmp_path):
    run_eval.record_pass(tmp_path, 1, "anthropic", "claude-x", [])
    recorded = json.loads((tmp_path / "pass1.json").read_text())
    assert set(recorded["models"]["claude-x"]["request"]) == {"model", "max_tokens"}


def test_a_recorded_pass_is_refused_before_any_call(tmp_path, monkeypatch):
    run_eval.write_json(
        tmp_path / "pass1.json",
        {"pass": 1, "method": run_eval.METHOD, "models": {"x-ai/grok-4.7": {"calls": []}}},
    )
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    monkeypatch.setattr(run_eval, "run_model", lambda *a, **k: pytest.fail("no call"))
    with pytest.raises(SystemExit, match="never overwritten"):
        run_eval.main(
            ["--provider", "openrouter", "--out", str(tmp_path), "--model", "x-ai/grok-4.7"]
        )
