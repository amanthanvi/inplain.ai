"""T3 — cited summaries and side-aware citation validation (issue #23).

No network: the HTTP call is injected into :class:`OpenRouterClient` (tests
hand it real ``requests.Response`` objects, so the error classification runs
for real), and the Summarizer takes the client as an argument.

The load-bearing test in this file is
:class:`TestAC3SweepOverWrittenSummaries`: every citation in every summary this
module writes must appear in the hunk it names, on the side it names. That is
AC-3, enforced by test rather than by review, over fixtures built from all 17
``eval/golden`` entries.
"""

from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path

import pytest
import requests

from inplain import schema
from inplain import summarize
from inplain.summarize import (
    ModelOutage,
    ModelReplyError,
    ModelRequestError,
    OpenRouterClient,
    Summarizer,
    build_prompt,
    citation_failure,
    citation_is_valid,
    normalize,
    parse_bullets,
    quote_on_side,
    resolve_api_key,
    review_bullets,
    select_hunks,
)

from run_eval import load_golden  # eval/ is on sys.path via conftest

# ---------------------------------------------------------------------------
# fixtures — change records built from the golden hunks
# ---------------------------------------------------------------------------

HUNK = {
    "id": "h1",
    "old_start": 10,
    "new_start": 10,
    "context_before": ["Communications"],
    "removed": ["You may not opt out of receiving these communications."],
    "added": ["You may opt out of receiving these communications at any time."],
    "context_after": [],
    "word_spans": None,
}
HUNKS = {"h1": HUNK}


def cite(hunk="h1", side="added", quote=""):
    return {"hunk": hunk, "side": side, "quote": quote}


def bullet(text="A claim.", citations=None):
    return {"text": text, "citations": list(citations if citations is not None else [cite()])}


def reply(bullets) -> str:
    return json.dumps({"bullets": bullets}, ensure_ascii=False)


def _sha(seed: str) -> str:
    return hashlib.sha1(seed.encode("utf-8")).hexdigest()


def make_record(
    *,
    company="example",
    company_name="Example Widgets, Inc.",
    doc="privacy",
    hunks=None,
    material=True,
    seed="seed",
) -> dict:
    commit = _sha(seed)
    return {
        "schema_version": 1,
        "id": schema.record_id(company, doc, commit),
        "company": company,
        "company_name": company_name,
        "doc": doc,
        "source_url": f"https://{company}.test/{doc}",
        "commit": commit,
        "parent_commit": _sha("parent:" + seed),
        "detected_at": "2026-08-19T00:00:00Z",
        "materiality": {
            "material": material,
            "reason": "added_prose_exceeds_sentence_threshold",
            "added_chars": 120,
            "removed_chars": 40,
            "similarity_badge": 0.97,
            "effective_date_change": None,
        },
        "hunks": copy.deepcopy(hunks if hunks is not None else [HUNK]),
    }


def record_from_golden(entry: dict) -> dict:
    return make_record(
        company=entry["company"],
        company_name=entry["company"].replace("-", " ").title(),
        doc=entry["doc"],
        hunks=entry["hunks"],
        seed=entry["id"],
    )


def write_record(changes: Path, record: dict) -> Path:
    path = changes / f"{record['id']}.json"
    schema.dump_record(record, path)
    return path


@pytest.fixture
def changes(tmp_path: Path) -> Path:
    directory = tmp_path / "changes"
    directory.mkdir()
    return directory


class FakeClient:
    """The model, scripted. Each reply is either text to return or an
    exception to raise."""

    def __init__(self, *replies) -> None:
        self.replies = list(replies)
        self.calls: list[tuple[str, str, str]] = []

    def complete(self, model: str, system: str, user: str) -> str:
        self.calls.append((model, system, user))
        item = self.replies[min(len(self.calls) - 1, len(self.replies) - 1)]
        if isinstance(item, Exception):
            raise item
        return item

    @property
    def models(self) -> list[str]:
        return [call[0] for call in self.calls]

    @property
    def prompts(self) -> list[str]:
        return [call[2] for call in self.calls]


def summarizer(changes: Path, client, **kwargs) -> Summarizer:
    kwargs.setdefault("now", lambda: "2026-08-20T09:00:00Z")
    return Summarizer(changes.parent, changes_dir=changes, client=client, **kwargs)


def http_response(payload=None, status=200, *, text=None) -> requests.Response:
    """A real requests.Response, so raise_for_status/json() behave for real."""
    response = requests.Response()
    response.status_code = status
    response.reason = "Test"
    response.url = summarize.API_URL
    body = text if text is not None else json.dumps(payload or {})
    response._content = body.encode("utf-8")
    response.headers["Content-Type"] = "application/json"
    return response


def completion_body(text: str | None) -> dict:
    return {
        "id": "gen-1",
        "model": summarize.DEFAULT_MODEL,
        "provider": summarize.PROVIDER_PINS[summarize.DEFAULT_MODEL],
        "choices": [{"message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
    }


# ---------------------------------------------------------------------------
# the gate
# ---------------------------------------------------------------------------


class TestNormalize:
    def test_collapses_whitespace_and_case(self):
        assert normalize("  We\tRETAIN \n data ") == "we retain data"

    def test_nothing_else_is_tolerated(self):
        # tolerance is ONLY whitespace and case (SPEC section 3)
        assert normalize("24 months") != normalize("12 months")
        assert normalize("don’t") != normalize("don't")
        assert normalize("sell") != normalize("share")


class TestCitationValidation:
    def test_exact_match_on_added_side(self):
        assert citation_is_valid(cite(quote="You may opt out of receiving"), HUNKS)

    def test_exact_match_on_removed_side(self):
        assert citation_is_valid(cite(side="removed", quote="You may not opt out"), HUNKS)

    def test_whitespace_and_case_tolerance_is_accepted(self):
        assert citation_is_valid(
            cite(quote="you  MAY opt\n out of receiving these communications"), HUNKS
        )

    def test_wrong_side_fails_even_though_the_text_exists(self):
        # the quote is real — it is on the OTHER side. Merging the sides into
        # one haystack is exactly the v0.2.0 defect.
        assert not citation_is_valid(cite(side="added", quote="You may not opt out"), HUNKS)
        assert not citation_is_valid(
            cite(side="removed", quote="You may opt out of receiving these"), HUNKS
        )

    def test_negation_flip_validates_only_against_its_true_side(self):
        flipped = cite(side="removed", quote="You may opt out of receiving these communications")
        assert not citation_is_valid(flipped, HUNKS)
        assert citation_is_valid(dict(flipped, side="added"), HUNKS)

    def test_paraphrase_is_never_repaired(self):
        assert not citation_is_valid(cite(quote="You can opt out of these communications"), HUNKS)

    def test_number_substitution_is_never_repaired(self):
        hunk = dict(HUNK, removed=["We retain logs for 24 months."], added=["We retain logs for 12 months."])
        assert not citation_is_valid(cite(side="removed", quote="We retain logs for 12 months."), {"h1": hunk})

    def test_unknown_hunk_bad_side_and_empty_quote_fail(self):
        assert not citation_is_valid(cite(hunk="h99", quote="opt out"), HUNKS)
        assert not citation_is_valid(cite(side="both", quote="opt out"), HUNKS)
        assert not citation_is_valid(cite(quote="   "), HUNKS)
        assert not citation_is_valid(cite(quote=42), HUNKS)
        assert not citation_is_valid("not an object", HUNKS)

    @pytest.mark.parametrize(
        "citation",
        [
            cite(hunk=["h1"], quote="You may opt out"),
            cite(hunk={"id": "h1"}, quote="You may opt out"),
            cite(side=["added"], quote="You may opt out"),
        ],
    )
    def test_wrong_typed_hunk_or_side_is_a_reason_not_a_raise(self, citation):
        assert "wrong type" in citation_failure(citation, HUNKS)

    def test_quote_may_span_lines_on_one_side(self):
        hunk = dict(HUNK, added=["First added line.", "Second added line."])
        assert quote_on_side("First added line.\nSecond added line.", hunk, "added")

    def test_a_quote_needs_one_whole_word_of_three_or_more_characters(self):
        # "a" and "of" appear on the added side, but carry no evidence.
        assert not citation_is_valid(cite(quote="a"), HUNKS)
        assert not citation_is_valid(cite(quote="of"), HUNKS)
        assert not citation_is_valid(cite(quote=" - "), HUNKS)
        assert citation_is_valid(cite(quote="may opt"), HUNKS)
        assert citation_is_valid(cite(quote="You"), HUNKS)

    def test_a_word_fragment_is_not_a_whole_word(self):
        # "ime" and "eceiving" are on the added side, but only as pieces of
        # "time" and "receiving"; the word must be whole in the side's text.
        assert not citation_is_valid(cite(quote="ime"), HUNKS)
        assert not citation_is_valid(cite(quote="eceiving"), HUNKS)
        assert not citation_is_valid(cite(quote="commun"), HUNKS)
        assert citation_is_valid(cite(quote="receiving"), HUNKS)
        assert citation_is_valid(cite(quote="RECEIVING  these"), HUNKS)
        # an inner word is whole whatever the edges cut: "these" here
        assert citation_is_valid(cite(quote="ng these comm"), HUNKS)

    def test_a_short_quote_drops_its_claim_with_a_reason(self):
        kept, drops = review_bullets([bullet("now sells your data", [cite(quote="a")])], [HUNK])
        assert kept == []
        assert "three or more characters" in drops[0].reason
        kept, drops = review_bullets([bullet("now sells your data", [cite(quote="ime")])], [HUNK])
        assert kept == []
        assert "whole word" in drops[0].reason


class TestReviewBullets:
    def test_valid_bullets_are_kept_and_normalized(self):
        bullets = [
            {
                "text": "  Opt-out became available.  ",
                "citations": [dict(cite(quote="You may opt out"), confidence=0.9)],
                "invented_key": "dropped",
            }
        ]
        kept, drops = review_bullets(bullets, [HUNK])
        assert drops == []
        assert kept == [
            {
                "text": "Opt-out became available.",
                "citations": [{"hunk": "h1", "side": "added", "quote": "You may opt out"}],
            }
        ]

    def test_one_bad_citation_drops_the_whole_claim(self):
        bullets = [
            bullet(
                "mixed",
                [cite(quote="You may opt out"), cite(quote="a quote nobody wrote")],
            )
        ]
        kept, drops = review_bullets(bullets, [HUNK])
        assert kept == []
        assert len(drops) == 1
        # the failed quote is recorded so the drop is auditable
        assert "a quote nobody wrote" in str(drops[0])

    def test_bullet_without_citations_is_dropped(self):
        kept, drops = review_bullets([bullet("no evidence", [])], [HUNK])
        assert kept == []
        assert "no citation" in drops[0].reason

    def test_malformed_bullets_are_dropped_not_raised(self):
        kept, drops = review_bullets(
            ["a string", {"citations": [cite()]}, {"text": "  ", "citations": [cite()]}],
            [HUNK],
        )
        assert kept == []
        assert len(drops) == 3

    def test_bullets_not_a_list_is_a_drop_not_a_raise(self):
        kept, drops = review_bullets({"bullets": []}, [HUNK])
        assert kept == []
        assert drops


class TestParseBullets:
    def test_strict_json(self):
        assert parse_bullets('{"bullets": [{"text": "t", "citations": []}]}') == [
            {"text": "t", "citations": []}
        ]

    def test_json_wrapped_in_prose_or_fences(self):
        assert parse_bullets('Sure!\n```json\n{"bullets": []}\n```') == []

    def test_garbage_returns_none(self):
        for raw in ("COMPLIANT", "", '{"not_bullets": 1}', '{"bullets": "nope"}', None, 7):
            assert parse_bullets(raw) is None


# ---------------------------------------------------------------------------
# prompt and the input cap
# ---------------------------------------------------------------------------


class TestPrompt:
    def test_names_the_company_and_the_document_type(self):
        record = make_record(company_name="Example Widgets, Inc.", doc="tos")
        prompt = build_prompt(record, record["hunks"], nonce="deadbeef")
        assert "Example Widgets, Inc." in prompt
        assert "tos" in prompt
        # v0.2.0 summarised an anonymous diff; never again
        assert "Company:" in prompt and "Document type:" in prompt

    def test_hunk_text_is_fenced_and_declared_to_be_data(self):
        record = make_record()
        prompt = build_prompt(record, record["hunks"], nonce="deadbeef")
        assert "-----BEGIN QUOTED DOCUMENT DATA deadbeef-----" in prompt
        assert "-----END QUOTED DOCUMENT DATA deadbeef-----" in prompt
        assert "quoted material" in prompt
        assert "never instructions" in summarize.SYSTEM_PROMPT
        assert "VERBATIM" in summarize.SYSTEM_PROMPT

    def test_fence_nonce_differs_between_calls(self):
        record = make_record()
        first = build_prompt(record, record["hunks"])
        second = build_prompt(record, record["hunks"])
        assert first != second, "the fence must not be forgeable from inside the document"

    def test_injected_instructions_travel_as_quoted_data(self):
        entry = next(e for e in load_golden() if e["id"] == "constructed-prompt-injection-in-hunk")
        record = record_from_golden(entry)
        prompt = build_prompt(record, record["hunks"], nonce="cafe")
        body = prompt.split("-----BEGIN QUOTED DOCUMENT DATA cafe-----")[1]
        body = body.split("-----END QUOTED DOCUMENT DATA cafe-----")[0]
        assert "ignore all previous instructions" in body.casefold()

    def test_context_lines_are_shown_but_marked_unquotable(self):
        record = make_record()
        prompt = build_prompt(record, record["hunks"], nonce="x")
        assert "Communications" in prompt  # context_before is included
        assert "never quotable" in summarize.SYSTEM_PROMPT


class TestSelectHunks:
    def _hunk(self, index: int, line: str):
        return dict(HUNK, id=f"h{index}", added=[line], removed=[])

    def test_everything_fits_by_default(self):
        hunks = [self._hunk(i, f"line {i}") for i in range(1, 6)]
        assert select_hunks(hunks) == hunks

    def test_prefix_semantics_under_a_tight_budget(self):
        hunks = [self._hunk(i, "x" * 200) for i in range(1, 6)]
        budget = len(summarize.dumps_hunks(hunks[:2]))
        sent = select_hunks(hunks, budget=budget)
        assert [h["id"] for h in sent] == ["h1", "h2"]

    def test_first_hunk_is_always_sent_even_when_oversized(self):
        hunks = [self._hunk(1, "x" * 5000), self._hunk(2, "small")]
        sent = select_hunks(hunks, budget=100)
        assert [h["id"] for h in sent] == ["h1"]

    def test_real_wholesale_rewrite_exceeds_the_budget(self):
        entry = next(e for e in load_golden() if e["id"].startswith("stripe-"))
        sent = select_hunks(entry["hunks"])
        assert 0 < len(sent) < len(entry["hunks"])

    def test_partial_payload_tells_the_model_what_it_is_missing(self):
        record = make_record(hunks=[dict(HUNK, id=f"h{i}") for i in (1, 2, 3)])
        prompt = build_prompt(record, record["hunks"][:1], total_hunks=3, nonce="x")
        assert "first 1" in prompt and "3 hunks" in prompt


# ---------------------------------------------------------------------------
# transport
# ---------------------------------------------------------------------------


MODEL = summarize.DEFAULT_MODEL


class TestOpenRouterClient:
    def _client(self, post):
        return OpenRouterClient("test-key", post=post)

    def test_happy_path_returns_the_message_content(self):
        seen = {}

        def post(url, headers=None, json=None, timeout=None):
            seen.update(url=url, headers=headers, payload=json, timeout=timeout)
            return http_response(completion_body('{"bullets": []}'))

        assert self._client(post).complete(MODEL, "sys", "user") == '{"bullets": []}'
        assert seen["url"] == "https://openrouter.ai/api/v1/chat/completions"
        assert seen["headers"]["Authorization"] == "Bearer test-key"
        assert seen["payload"]["model"] == MODEL
        assert seen["payload"]["messages"] == [
            {"role": "system", "content": "sys"},
            {"role": "user", "content": "user"},
        ]

    def test_the_provider_is_pinned_with_no_fallback_and_no_data_collection(self):
        seen = {}

        def post(url, headers=None, json=None, timeout=None):
            seen.update(payload=json)
            return http_response(completion_body('{"bullets": []}'))

        self._client(post).complete(MODEL, "s", "u")
        assert seen["payload"]["provider"] == {
            "order": [summarize.PROVIDER_PINS[MODEL]],
            "allow_fallbacks": False,
            "data_collection": "deny",
        }
        assert "require_parameters" not in seen["payload"]["provider"]

    def test_temperature_zero_except_for_models_that_reject_it(self, monkeypatch):
        monkeypatch.setitem(summarize.PROVIDER_PINS, "vendor/accepts", "vendor")
        monkeypatch.setitem(summarize.PROVIDER_PINS, "anthropic/claude-sonnet-5", "anthropic")
        sent = []

        def post(url, headers=None, json=None, timeout=None):
            sent.append(json)
            return http_response(completion_body('{"bullets": []}'))

        self._client(post).complete("vendor/accepts", "s", "u")
        self._client(post).complete("anthropic/claude-sonnet-5", "s", "u")
        assert sent[0]["temperature"] == 0
        assert "temperature" not in sent[1]

    def test_an_unpinned_model_is_refused_without_a_call(self):
        def post(*args, **kwargs):  # pragma: no cover - must not be reached
            raise AssertionError("an unpinned model must never reach the network")

        with pytest.raises(ModelRequestError, match="no provider pin"):
            self._client(post).complete("vendor/unlisted", "s", "u")

    @pytest.mark.parametrize(
        "exc",
        [requests.exceptions.Timeout("slow"), requests.exceptions.ConnectionError("refused")],
    )
    def test_timeout_and_connection_errors_are_outages(self, exc):
        def post(*args, **kwargs):
            raise exc

        with pytest.raises(ModelOutage):
            self._client(post).complete(MODEL, "s", "u")

    @pytest.mark.parametrize("status", [429, 500, 502, 503, 529])
    def test_server_errors_and_rate_limits_are_outages(self, status):
        def post(*args, **kwargs):
            return http_response({"error": "x"}, status=status)

        with pytest.raises(ModelOutage):
            self._client(post).complete(MODEL, "s", "u")

    @pytest.mark.parametrize("status", [400, 401, 402, 403, 404])
    def test_client_errors_are_request_errors_not_outages(self, status):
        def post(*args, **kwargs):
            return http_response({"error": "x"}, status=status)

        with pytest.raises(ModelRequestError):
            self._client(post).complete(MODEL, "s", "u")

    def test_request_error_message_does_not_leak_the_key(self):
        def post(*args, **kwargs):
            return http_response({"error": {"message": "No auth credentials found"}}, status=401)

        with pytest.raises(ModelRequestError) as info:
            self._client(post).complete(MODEL, "s", "u")
        assert "test-key" not in str(info.value)

    def test_non_json_body_is_a_reply_error(self):
        def post(*args, **kwargs):
            return http_response(text="<html>gateway</html>")

        with pytest.raises(ModelReplyError):
            self._client(post).complete(MODEL, "s", "u")

    @pytest.mark.parametrize(
        "body",
        [{"choices": "not a list"}, {}, {"choices": []}, {"choices": [{}]}, []],
    )
    def test_unexpected_envelope_shape_is_a_reply_error(self, body):
        def post(*args, **kwargs):
            return http_response(body)

        with pytest.raises(ModelReplyError):
            self._client(post).complete(MODEL, "s", "u")

    def test_null_content_is_an_empty_reply_not_a_crash(self):
        def post(*args, **kwargs):
            return http_response(completion_body(None))

        assert self._client(post).complete(MODEL, "s", "u") == ""

    def test_unclassified_transport_faults_are_not_outages(self):
        # no fallback spend for a failure mode we have not understood
        def post(*args, **kwargs):
            raise requests.exceptions.TooManyRedirects("loop")

        with pytest.raises(ModelRequestError):
            self._client(post).complete(MODEL, "s", "u")


class TestResolveApiKey:
    def test_prefers_model_api_key_then_openrouter(self):
        assert resolve_api_key({"MODEL_API_KEY": "a", "OPENROUTER_API_KEY": "b"}) == "a"
        assert resolve_api_key({"OPENROUTER_API_KEY": "b"}) == "b"
        assert resolve_api_key({"ANTHROPIC_API_KEY": "c"}) is None

    def test_blank_and_missing_are_no_key(self):
        assert resolve_api_key({}) is None
        assert resolve_api_key({"MODEL_API_KEY": "   "}) is None


# ---------------------------------------------------------------------------
# writing summaries
# ---------------------------------------------------------------------------


class TestSummariesWritten:
    def test_valid_citations_are_written_into_the_record(self, changes):
        path = write_record(changes, make_record())
        client = FakeClient(
            reply(
                [
                    bullet(
                        "Users can now opt out of these communications.",
                        [
                            cite(side="removed", quote="You may not opt out"),
                            cite(side="added", quote="You may opt out of receiving"),
                        ],
                    )
                ]
            )
        )
        report = summarizer(changes, client).run()
        assert report.written == 1 and report.failed == 0

        record = schema.load_record(path)  # validates
        summary = record["summary"]
        assert summary["model"] == summarize.DEFAULT_MODEL
        assert summary["generated_at"] == "2026-08-20T09:00:00Z"
        assert summary["coverage"] == {"covered_hunks": 1, "total_hunks": 1}
        assert len(summary["bullets"]) == 1
        assert [c["side"] for c in summary["bullets"][0]["citations"]] == ["removed", "added"]

    def test_nothing_but_the_summary_key_changes(self, changes):
        record = make_record()
        path = write_record(changes, record)
        client = FakeClient(reply([bullet("t", [cite(quote="You may opt out")])]))
        summarizer(changes, client).run()
        written = schema.load_record(path)
        assert {k: v for k, v in written.items() if k != "summary"} == record

    def test_a_record_that_does_not_match_the_schema_is_reported_not_raised(self, changes):
        broken = make_record()
        broken["hunks"][0]["word_spans"] = [[0, [[0, 4]]]]  # reserved, must be null
        path = changes / f"{broken['id']}.json"
        path.write_text(schema.dumps_record(broken), encoding="utf-8", newline="\n")
        client = FakeClient(reply([bullet()]))
        report = summarizer(changes, client).run()
        assert report.outcomes[0].status == summarize.UNREADABLE
        assert client.calls == [], "a bad record must not reach the model"

    def test_whitespace_and_case_tolerant_quote_is_accepted(self, changes):
        path = write_record(changes, make_record())
        client = FakeClient(
            reply([bullet("t", [cite(quote="YOU MAY   opt out\nof receiving")])])
        )
        summarizer(changes, client).run()
        assert schema.load_record(path)["summary"]["bullets"]

    def test_wrong_side_citation_is_dropped(self, changes):
        path = write_record(changes, make_record())
        client = FakeClient(
            reply(
                [
                    bullet("kept", [cite(side="removed", quote="You may not opt out")]),
                    # real text, wrong side: this is the v0.2.0 failure
                    bullet("dropped", [cite(side="added", quote="You may not opt out")]),
                ]
            )
        )
        summarizer(changes, client).run()
        bullets = schema.load_record(path)["summary"]["bullets"]
        assert [b["text"] for b in bullets] == ["kept"]

    def test_paraphrased_quote_is_dropped(self, changes):
        path = write_record(changes, make_record())
        client = FakeClient(
            reply(
                [
                    bullet("kept", [cite(quote="You may opt out")]),
                    bullet("dropped", [cite(quote="You can opt out whenever you like")]),
                ]
            )
        )
        summarizer(changes, client).run()
        assert [b["text"] for b in schema.load_record(path)["summary"]["bullets"]] == ["kept"]

    def test_wrong_typed_hunk_drops_one_claim_not_the_reply(self, changes):
        path = write_record(changes, make_record())
        client = FakeClient(
            reply(
                [
                    bullet("kept", [cite(quote="You may opt out")]),
                    bullet("dropped", [cite(hunk=["h1"], quote="You may opt out")]),
                ]
            )
        )
        report = summarizer(changes, client).run()
        assert report.written == 1 and report.failed == 0
        assert report.outcomes[0].dropped == 1
        assert [b["text"] for b in schema.load_record(path)["summary"]["bullets"]] == ["kept"]

    def test_negation_flip_is_dropped_rather_than_repaired(self, changes):
        entry = next(e for e in load_golden() if e["id"] == "constructed-negation-sell-to-share")
        record = record_from_golden(entry)
        path = write_record(changes, record)
        removed_line = record["hunks"][0]["removed"][0]
        added_line = record["hunks"][0]["added"][0]
        client = FakeClient(
            reply(
                [
                    # asserts the added line was removed — the exact substitution
                    # v0.2.0's repair tier used to perform silently
                    bullet("flipped", [cite(side="removed", quote=added_line)]),
                    bullet("honest", [cite(side="removed", quote=removed_line)]),
                ]
            )
        )
        summarizer(changes, client).run()
        bullets = schema.load_record(path)["summary"]["bullets"]
        assert [b["text"] for b in bullets] == ["honest"]

    def test_only_material_unsummarised_records_are_picked_up(self, changes):
        write_record(changes, make_record(seed="immaterial", material=False))
        done = make_record(seed="already-done")
        done["summary"] = {
            "model": "m",
            "generated_at": "2026-01-01T00:00:00Z",
            "coverage": {"covered_hunks": 1, "total_hunks": 1},
            "bullets": [bullet("t", [cite(quote="You may opt out")])],
        }
        write_record(changes, done)
        pending = write_record(changes, make_record(seed="pending"))
        assert summarizer(changes, FakeClient()).pending() == [pending]

    def test_limit_caps_the_run(self, changes):
        for index in range(3):
            write_record(changes, make_record(seed=f"r{index}"))
        client = FakeClient(reply([bullet("t", [cite(quote="You may opt out")])]))
        report = summarizer(changes, client).run(limit=2)
        assert report.eligible == 3
        assert report.written == 2
        assert len(client.calls) == 2

    def test_dry_run_calls_nothing_and_writes_nothing(self, changes):
        path = write_record(changes, make_record())
        before = path.read_bytes()
        client = FakeClient(reply([bullet()]))
        report = Summarizer(changes.parent, changes_dir=changes, client=client, dry_run=True).run()
        assert client.calls == []
        assert path.read_bytes() == before
        assert report.written == 1  # "would have summarized"


class TestPartialCoverage:
    def test_capped_input_records_what_the_model_saw(self, changes):
        entry = next(e for e in load_golden() if e["id"].startswith("stripe-"))
        record = record_from_golden(entry)
        path = write_record(changes, record)
        sent = select_hunks(record["hunks"])
        client = FakeClient(reply(entry["expected"]["bullets"]))
        summarizer(changes, client).run()

        summary = schema.load_record(path)["summary"]
        coverage = summary["coverage"]
        assert coverage["total_hunks"] == len(record["hunks"])
        assert coverage["covered_hunks"] == len(sent)
        assert coverage["covered_hunks"] < coverage["total_hunks"]
        # the hunks the model saw are exactly hunks[:covered_hunks]
        payload_ids = {h["id"] for h in record["hunks"][: coverage["covered_hunks"]]}
        cited = {c["hunk"] for b in summary["bullets"] for c in b["citations"]}
        assert cited <= payload_ids

    def test_citation_to_a_hunk_that_was_never_sent_is_dropped(self, changes):
        hunks = [
            dict(HUNK, id="h1", added=["x" * 4000], removed=[]),
            dict(HUNK, id="h2", added=["A second hunk the model never saw."], removed=[]),
        ]
        path = write_record(changes, make_record(hunks=hunks))
        client = FakeClient(
            reply([bullet("out of payload", [cite(hunk="h2", quote="A second hunk")])])
        )
        report = summarizer(changes, client, budget=4200).run()
        assert report.written == 0
        assert "summary" not in schema.load_record(path)


# ---------------------------------------------------------------------------
# the post-spend guarantee
# ---------------------------------------------------------------------------


def _unchanged(path: Path, before: bytes, *, attempts: int | None = None) -> None:
    """Byte-identical except, after a paid run, its ``summary_attempts`` count
    (the only key a failed run may write)."""
    record = schema.load_record(path)  # still valid
    assert "summary" not in record, "a failed run must leave the record unsummarised"
    if attempts is None:
        assert path.read_bytes() == before, "the record was modified by a failed run"
        return
    assert record.pop("summary_attempts") == attempts
    assert schema.dumps_record(record).encode("utf-8") == before, (
        "the record was modified by a failed run"
    )


class TestNoRaiseAfterTheModelReturns:
    """From the moment the API returns, every path ends in a written summary or
    a logged, retryable no-op. v0.2.0 had four raise sites after the spend."""

    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("COMPLIANT", summarize.PARSE_FAILURE),
            ("", summarize.PARSE_FAILURE),
            ('{"bullets": "not a list"}', summarize.PARSE_FAILURE),
            ('{"result": "ok"}', summarize.PARSE_FAILURE),
            ('{"bullets": [{"text": "t", "citations": [{"hunk": "h1", "side": "added",'
             ' "quote": "invented"}]}]}', summarize.NO_VALID_BULLETS),
            ('{"bullets": [{"text": "t", "citations": []}]}', summarize.NO_VALID_BULLETS),
            ('{"bullets": []}', summarize.NO_VALID_BULLETS),
            ('{"bullets": [null]}', summarize.NO_VALID_BULLETS),
        ],
    )
    def test_bad_output_leaves_the_record_untouched_and_retryable(self, changes, raw, expected):
        path = write_record(changes, make_record())
        before = path.read_bytes()
        report = summarizer(changes, FakeClient(raw)).run()
        (outcome,) = report.outcomes
        assert outcome.status == expected
        assert outcome.status in summarize.RETRYABLE
        assert not outcome.halt, "malformed output is a per-record no-op, not a halt"
        _unchanged(path, before, attempts=1)

    def test_failure_mid_write_leaves_the_record_valid(self, changes, monkeypatch):
        path = write_record(changes, make_record())
        before = path.read_bytes()

        def boom(src, dst):
            raise OSError("disk went away mid-write")

        monkeypatch.setattr(summarize.os, "replace", boom)
        report = summarizer(
            changes, FakeClient(reply([bullet("t", [cite(quote="You may opt out")])]))
        ).run()
        assert report.outcomes[0].status == summarize.WRITE_FAILURE
        _unchanged(path, before)
        assert list(changes.glob("*.tmp")) == [], "the temp file must not be left behind"

    def test_unexpected_error_after_the_call_is_contained(self, changes, monkeypatch):
        path = write_record(changes, make_record())
        before = path.read_bytes()

        def boom(record):
            raise RuntimeError("something nobody predicted")

        # serialization is reached only after the model has answered
        monkeypatch.setattr(summarize.schema, "dumps_record", boom)
        report = summarizer(
            changes, FakeClient(reply([bullet("t", [cite(quote="You may opt out")])]))
        ).run()
        assert report.outcomes[0].status == summarize.WRITE_FAILURE
        monkeypatch.undo()
        _unchanged(path, before)

    def test_unusable_reply_envelope_is_a_no_op_not_a_halt(self, changes):
        path = write_record(changes, make_record(seed="a"))
        other = write_record(changes, make_record(seed="b"))
        before = path.read_bytes()
        client = FakeClient(
            ModelReplyError("envelope"),
            reply([bullet("t", [cite(quote="You may opt out")])]),
        )
        report = summarizer(changes, client).run()
        assert len(report.outcomes) == 2, "a bad envelope must not stop the run"
        _unchanged(path, before, attempts=1)
        assert "summary" in schema.load_record(other)

    def test_all_claims_dropped_is_logged_with_the_failed_quote(self, changes, caplog):
        write_record(changes, make_record())
        with caplog.at_level("WARNING", logger="inplain.summarize"):
            summarizer(
                changes, FakeClient(reply([bullet("t", [cite(quote="never written")])]))
            ).run()
        assert "never written" in caplog.text


class TestRetryCap:
    def test_a_record_that_keeps_failing_stops_being_sent(self, changes):
        path = write_record(changes, make_record())
        for attempt in range(1, summarize.MAX_SUMMARY_ATTEMPTS + 1):
            report = summarizer(changes, FakeClient("COMPLIANT")).run()
            assert report.failed == 1
            assert schema.load_record(path)["summary_attempts"] == attempt
        assert report.capped == [path.stem], "the run that reaches the cap names it"

        before = path.read_bytes()
        client = FakeClient(reply([bullet("t", [cite(quote="You may opt out")])]))
        report = summarizer(changes, client).run()
        assert client.calls == [], "a capped record is not billed again"
        assert report.eligible == 0 and report.failed == 0
        assert report.capped == [path.stem], "but every later run still names it"
        assert path.read_bytes() == before

    def test_a_capped_record_fails_the_cli(self, changes, monkeypatch, capsys):
        """The cap must never hide a failure: a run-wide garbage reply caps
        every record, so a run with a capped record exits non-zero (the crawl
        then sets summarize_failed and the alert fires) and names it."""
        record = make_record()
        record["summary_attempts"] = summarize.MAX_SUMMARY_ATTEMPTS
        path = write_record(changes, record)
        client = FakeClient("unused")
        monkeypatch.setenv("MODEL_API_KEY", "k")
        monkeypatch.setattr(summarize, "OpenRouterClient", lambda *a, **k: client)
        code = summarize.main(["--root", str(changes.parent), "--changes", str(changes)])
        assert code == 1
        assert f"failed=0 capped={path.stem}" in capsys.readouterr().out
        assert client.calls == []

    def test_a_summary_clears_the_count(self, changes):
        record = make_record()
        record["summary_attempts"] = 2
        path = write_record(changes, record)
        client = FakeClient(reply([bullet("t", [cite(quote="You may opt out")])]))
        summarizer(changes, client).run()
        written = schema.load_record(path)
        assert written["summary"]["bullets"]
        assert "summary_attempts" not in written

    def test_a_failed_write_after_the_reply_counts(self, changes, monkeypatch):
        path = write_record(changes, make_record())
        before = path.read_bytes()

        def boom(*args):
            raise RuntimeError("something nobody predicted")

        monkeypatch.setattr(Summarizer, "_finish", boom)
        report = summarizer(changes, FakeClient(reply([bullet()]))).run()
        assert report.outcomes[0].status == summarize.WRITE_FAILURE
        _unchanged(path, before, attempts=1)

    def test_a_refusal_before_any_reply_is_not_counted(self, changes):
        """A run-wide 400 (a bad model id or parameter) refuses every record at
        no cost; counting it would cap the whole queue and silence the alert."""
        path = write_record(changes, make_record())
        before = path.read_bytes()
        refused = ModelRequestError("model API refused the request (HTTP 400)", status=400)
        for _ in range(summarize.MAX_SUMMARY_ATTEMPTS + 1):
            report = summarizer(changes, FakeClient(refused)).run()
            assert report.failed == 1, "it keeps alerting"
        _unchanged(path, before)


class TestFallback:
    def test_outage_falls_back_once(self, changes):
        path = write_record(changes, make_record())
        client = FakeClient(
            ModelOutage("503 from the primary"),
            reply([bullet("t", [cite(quote="You may opt out")])]),
        )
        report = summarizer(changes, client).run()
        assert client.models == [summarize.DEFAULT_MODEL, summarize.FALLBACK_MODEL]
        assert report.written == 1
        assert schema.load_record(path)["summary"]["model"] == summarize.FALLBACK_MODEL

    def test_malformed_output_never_triggers_the_fallback(self, changes):
        write_record(changes, make_record())
        client = FakeClient("COMPLIANT")
        summarizer(changes, client).run()
        assert client.models == [summarize.DEFAULT_MODEL]

    def test_reply_envelope_error_never_triggers_the_fallback(self, changes):
        write_record(changes, make_record())
        client = FakeClient(ModelReplyError("bad envelope"))
        summarizer(changes, client).run()
        assert client.models == [summarize.DEFAULT_MODEL]

    def test_request_error_never_triggers_the_fallback(self, changes):
        write_record(changes, make_record())
        client = FakeClient(ModelRequestError("HTTP 401"))
        summarizer(changes, client).run()
        assert client.models == [summarize.DEFAULT_MODEL]

    def test_per_record_refusal_skips_the_record_and_continues(self, changes):
        # A 413-class refusal is a property of one record's payload, not of
        # the run: the poisoned record is skipped (retryable) and the queue
        # is not starved.
        paths = {
            path: path.read_bytes()
            for path in (
                write_record(changes, make_record(seed="aaa")),
                write_record(changes, make_record(seed="bbb")),
            )
        }
        client = FakeClient(
            ModelRequestError("model API refused the request (HTTP 413)", status=413),
            reply([bullet("t", [cite(quote="You may opt out")])]),
        )
        report = summarizer(changes, client).run()
        assert not report.aborted
        assert len(report.outcomes) == 2
        assert report.written == 1
        summarised = [p for p in paths if "summary" in schema.load_record(p)]
        assert len(summarised) == 1, "the record after the refused one is reached"
        (skipped,) = [p for p in paths if p not in summarised]
        _unchanged(skipped, paths[skipped])
        assert client.models == [summarize.DEFAULT_MODEL, summarize.DEFAULT_MODEL]

    def test_auth_refusal_still_halts_the_run(self, changes):
        for seed in ("aaa", "bbb"):
            write_record(changes, make_record(seed=seed))
        client = FakeClient(
            ModelRequestError("model API refused the request (HTTP 401)", status=401)
        )
        report = summarizer(changes, client).run()
        assert report.aborted
        assert len(report.outcomes) == 1

    def test_outage_on_both_models_halts_the_run_and_touches_nothing(self, changes):
        paths = [write_record(changes, make_record(seed=f"r{i}")) for i in range(3)]
        before = [p.read_bytes() for p in paths]
        client = FakeClient(ModelOutage("down"))
        report = summarizer(changes, client).run()
        assert len(client.calls) == 2, "one primary attempt, one fallback attempt, then stop"
        assert len(report.outcomes) == 1 and report.aborted
        for path, original in zip(paths, before, strict=True):
            _unchanged(path, original)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


class TestCli:
    def test_missing_key_exits_before_any_state_change(self, changes, monkeypatch, capsys):
        path = write_record(changes, make_record())
        before = path.read_bytes()
        monkeypatch.delenv("MODEL_API_KEY", raising=False)
        monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

        def never(*args, **kwargs):  # pragma: no cover - must not be reached
            raise AssertionError("no client may be built without a key")

        monkeypatch.setattr(summarize, "OpenRouterClient", never)
        monkeypatch.setattr(
            Summarizer, "run", lambda *a, **k: pytest.fail("the run must not start")
        )
        code = summarize.main(["--root", str(changes.parent), "--changes", str(changes)])
        assert code == 2
        assert "MODEL_API_KEY" in capsys.readouterr().err
        _unchanged(path, before)

    def test_dry_run_needs_no_key(self, changes, monkeypatch, capsys):
        path = write_record(changes, make_record())
        before = path.read_bytes()
        monkeypatch.delenv("MODEL_API_KEY", raising=False)
        monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
        code = summarize.main(
            ["--root", str(changes.parent), "--changes", str(changes), "--dry-run"]
        )
        assert code == 0
        assert "eligible=1" in capsys.readouterr().out
        assert path.read_bytes() == before

    def test_exit_code_signals_an_unsummarised_record(self, changes, monkeypatch, capsys):
        write_record(changes, make_record())
        monkeypatch.setenv("MODEL_API_KEY", "k")
        monkeypatch.setattr(
            summarize, "OpenRouterClient", lambda *a, **k: FakeClient("COMPLIANT")
        )
        code = summarize.main(["--root", str(changes.parent), "--changes", str(changes)])
        assert code == 1
        assert "failed=1" in capsys.readouterr().out

    def test_nothing_to_do_is_success(self, changes, monkeypatch, capsys):
        monkeypatch.setenv("OPENROUTER_API_KEY", "k")
        monkeypatch.setattr(
            summarize, "OpenRouterClient", lambda *a, **k: FakeClient("unused")
        )
        code = summarize.main(["--root", str(changes.parent), "--changes", str(changes)])
        assert code == 0
        assert "eligible=0" in capsys.readouterr().out

    def test_model_flag_is_honoured(self, changes, monkeypatch):
        write_record(changes, make_record())
        client = FakeClient(reply([bullet("t", [cite(quote="You may opt out")])]))
        monkeypatch.setenv("MODEL_API_KEY", "k")
        monkeypatch.setattr(summarize, "OpenRouterClient", lambda *a, **k: client)
        summarize.main(
            [
                "--root",
                str(changes.parent),
                "--changes",
                str(changes),
                "--model",
                "some-other-model",
            ]
        )
        assert client.models == ["some-other-model"]


# ---------------------------------------------------------------------------
# AC-3, enforced by test
# ---------------------------------------------------------------------------

GOLDEN = load_golden()


def poisoned_reply(entry: dict) -> list[dict]:
    """The golden bullets, plus poison: a wrong-side copy and a paraphrase of
    each, neither of which may ever reach the written record."""
    bullets = copy.deepcopy(entry["expected"]["bullets"])
    out = list(bullets)
    for original in bullets:
        flipped = copy.deepcopy(original)
        flipped["text"] = "WRONG SIDE " + original["text"]
        for citation in flipped["citations"]:
            citation["side"] = "added" if citation["side"] == "removed" else "removed"
        paraphrased = copy.deepcopy(original)
        paraphrased["text"] = "PARAPHRASE " + original["text"]
        for citation in paraphrased["citations"]:
            citation["quote"] = citation["quote"].replace("e", "3") + " (roughly)"
        out += [flipped, paraphrased]
    return out


@pytest.fixture(scope="module")
def written(tmp_path_factory) -> list[Path]:
    """Every golden entry, summarized for real through the Summarizer against a
    scripted model, then swept below."""
    directory = tmp_path_factory.mktemp("ac3") / "changes"
    directory.mkdir()
    paths = []
    for entry in GOLDEN:
        record = record_from_golden(entry)
        path = write_record(directory, record)
        client = FakeClient(reply(poisoned_reply(entry)))
        Summarizer(
            directory.parent,
            changes_dir=directory,
            client=client,
            now=lambda: "2026-08-20T09:00:00Z",
        ).summarize_record(path)
        if "summary" in json.loads(path.read_text(encoding="utf-8")):
            paths.append(path)
    return paths


class TestAC3SweepOverWrittenSummaries:
    """AC-3: every published citation's quote appears in the hunk it names, on
    the side it names. Swept over summaries this module actually wrote, for
    fixtures built from every golden entry — with replies deliberately
    corrupted by wrong-side and paraphrased quotes, so the sweep proves the
    drops as well as the keeps.
    """

    def test_the_sweep_has_material(self, written):
        assert len(written) >= 15, "the sweep must cover the golden set"

    def test_every_citation_appears_on_the_side_it_names(self, written):
        checked = 0
        for path in written:
            record = schema.load_record(path)  # structurally valid too
            hunks = {h["id"]: h for h in record["hunks"]}
            for claim in record["summary"]["bullets"]:
                assert claim["citations"], "a published bullet always cites"
                for citation in claim["citations"]:
                    assert citation["hunk"] in hunks, f"{record['id']}: unknown hunk"
                    assert citation["side"] in ("added", "removed")
                    hunk = hunks[citation["hunk"]]
                    assert quote_on_side(citation["quote"], hunk, citation["side"]), (
                        f"{record['id']}: {citation['quote'][:60]!r} is not on the "
                        f"{citation['side']} side of {citation['hunk']}"
                    )
                    # and never on the other side only
                    checked += 1
        assert checked >= 15

    def test_no_poisoned_claim_survived(self, written):
        for path in written:
            for claim in schema.load_record(path)["summary"]["bullets"]:
                assert not claim["text"].startswith("WRONG SIDE ")
                assert not claim["text"].startswith("PARAPHRASE ")

    def test_coverage_never_overstates_what_was_sent(self, written):
        for path in written:
            record = schema.load_record(path)
            coverage = record["summary"]["coverage"]
            assert coverage["total_hunks"] == len(record["hunks"])
            assert 1 <= coverage["covered_hunks"] <= coverage["total_hunks"]
            assert coverage["covered_hunks"] == len(select_hunks(record["hunks"]))
