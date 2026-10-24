"""inplain.schema — the executable form of the G1 normative change-record
schema, including the test that ties R2's golden fixtures to it."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from inplain import schema
from inplain.schema import (
    ChangeRecord,
    Hunk,
    Materiality,
    SchemaError,
    dump_record,
    dumps_record,
    load_record,
    record_id,
    validate_hunk,
    validate_record,
)

GOLDEN_DIR = Path(__file__).resolve().parents[1] / "eval" / "golden"

SHA_A = "a" * 40
SHA_B = "b" * 40


def make_hunk(**overrides) -> dict:
    hunk = {
        "id": "h1",
        "old_start": 12,
        "new_start": 12,
        "context_before": ["before"],
        "removed": ["old line"],
        "added": ["new line"],
        "context_after": ["after"],
        "word_spans": None,
    }
    hunk.update(overrides)
    return hunk


def make_record(**overrides) -> dict:
    record = {
        "schema_version": 1,
        "id": record_id("example", "privacy", SHA_A),
        "company": "example",
        "company_name": "Example",
        "doc": "privacy",
        "source_url": "https://example.com/privacy",
        "commit": SHA_A,
        "parent_commit": SHA_B,
        "detected_at": "2026-08-19T12:00:00Z",
        "materiality": {
            "material": True,
            "reason": "added_prose_exceeds_sentence_threshold",
            "added_chars": 120,
            "removed_chars": 0,
            "similarity_badge": 0.98,
            "effective_date_change": None,
        },
        "hunks": [make_hunk()],
    }
    record.update(overrides)
    return record


# --------------------------------------------------------------------------
# validate_record / validate_hunk


def test_valid_record_passes():
    validate_record(make_record())


def test_record_id_is_company_doc_shortsha7():
    assert record_id("example", "privacy", SHA_A) == f"example-privacy-{'a' * 7}"


def test_id_must_derive_from_the_document_commit():
    with pytest.raises(SchemaError, match="id must be"):
        validate_record(make_record(id="example-privacy-zzzzzzz"))


def test_missing_top_level_key_rejected():
    record = make_record()
    del record["parent_commit"]
    with pytest.raises(SchemaError, match="missing keys"):
        validate_record(record)


def test_unexpected_top_level_key_rejected():
    with pytest.raises(SchemaError, match="unexpected keys"):
        validate_record(make_record(similarity=0.5))


def test_summary_is_optional():
    record = make_record(
        summary={
            "model": "m",
            "generated_at": "2026-08-19T12:00:00Z",
            "coverage": {"covered_hunks": 1, "total_hunks": 1},
            "bullets": [
                {
                    "text": "One line changed.",
                    "citations": [{"hunk": "h1", "side": "added", "quote": "new line"}],
                }
            ],
        }
    )
    validate_record(record)


def test_summary_citation_must_name_a_hunk_and_side():
    bad = {
        "bullets": [
            {
                "text": "claim",
                "citations": [{"hunk": "h9", "side": "added", "quote": "q"}],
            }
        ]
    }
    with pytest.raises(SchemaError, match="must name a hunk"):
        validate_record(make_record(summary=bad))
    bad["bullets"][0]["citations"] = [{"hunk": "h1", "side": "both", "quote": "q"}]
    with pytest.raises(SchemaError, match="side"):
        validate_record(make_record(summary=bad))


def test_hunk_key_set_must_match_exactly():
    with pytest.raises(SchemaError, match="keys must be exactly"):
        validate_hunk(make_hunk(extra=1))
    hunk = make_hunk()
    del hunk["word_spans"]
    with pytest.raises(SchemaError, match="keys must be exactly"):
        validate_hunk(hunk)


def test_word_spans_must_be_null_in_v1():
    with pytest.raises(SchemaError, match="word_spans is reserved"):
        validate_hunk(make_hunk(word_spans={"added": []}))


def test_context_capped_at_three_lines():
    with pytest.raises(SchemaError, match="capped at 3"):
        validate_hunk(make_hunk(context_before=["a", "b", "c", "d"]))
    with pytest.raises(SchemaError, match="capped at 3"):
        validate_hunk(make_hunk(context_after=["a", "b", "c", "d"]))


def test_hunk_must_change_something():
    with pytest.raises(SchemaError, match="must change something"):
        validate_hunk(make_hunk(removed=[], added=[]))


def test_hunk_line_numbers_are_one_based_ints():
    with pytest.raises(SchemaError, match="old_start"):
        validate_hunk(make_hunk(old_start=0))
    with pytest.raises(SchemaError, match="new_start"):
        validate_hunk(make_hunk(new_start="12"))


def test_duplicate_hunk_ids_rejected():
    with pytest.raises(SchemaError, match="duplicate hunk id"):
        validate_record(make_record(hunks=[make_hunk(), make_hunk()]))


def test_record_needs_at_least_one_hunk():
    with pytest.raises(SchemaError, match="non-empty"):
        validate_record(make_record(hunks=[]))


def test_materiality_reason_always_recorded():
    record = make_record()
    record["materiality"]["reason"] = ""
    with pytest.raises(SchemaError, match="reason must ALWAYS be recorded"):
        validate_record(record)


def test_materiality_effective_date_change_shape():
    record = make_record()
    record["materiality"]["effective_date_change"] = {"from": "2025-01-01"}
    with pytest.raises(SchemaError, match="effective_date_change"):
        validate_record(record)
    record["materiality"]["effective_date_change"] = {
        "from": "2025-01-01",
        "to": "2026-03-15",
    }
    validate_record(record)


def test_detected_at_must_be_utc_instant():
    with pytest.raises(SchemaError, match="detected_at"):
        validate_record(make_record(detected_at="2026-08-19T12:00:00+02:00"))


def test_commit_shas_must_be_full_40_hex():
    with pytest.raises(SchemaError, match="commit"):
        validate_record(make_record(commit="a1b2c3d", id="example-privacy-a1b2c3d"))


# --------------------------------------------------------------------------
# dataclasses → dict


def test_dataclasses_produce_a_valid_record():
    record = ChangeRecord(
        company="example",
        company_name="Example",
        doc="privacy",
        source_url="https://example.com/privacy",
        commit=SHA_A,
        parent_commit=SHA_B,
        detected_at="2026-08-19T12:00:00Z",
        materiality=Materiality(
            material=False,
            reason="below_sentence_threshold",
            added_chars=5,
            removed_chars=0,
            similarity_badge=0.9999,
        ),
        hunks=[
            Hunk(
                id="h1",
                old_start=1,
                new_start=1,
                context_before=[],
                removed=[],
                added=["tiny"],
                context_after=["ctx"],
            )
        ],
    )
    payload = record.to_dict()
    validate_record(payload)
    assert payload["id"] == f"example-privacy-{'a' * 7}"
    assert payload["hunks"][0]["word_spans"] is None


# --------------------------------------------------------------------------
# JSON serialization: sorted keys, LF, trailing newline


def test_dumps_sorted_keys_and_trailing_newline():
    text = dumps_record(make_record())
    assert text.endswith("}\n")
    parsed = json.loads(text)
    assert list(parsed) == sorted(parsed)
    assert list(parsed["hunks"][0]) == sorted(parsed["hunks"][0])


def test_dump_and_load_roundtrip_lf_only(tmp_path):
    path = tmp_path / "changes" / "example-privacy-aaaaaaa.json"
    record = make_record()
    dump_record(record, path)
    raw = path.read_bytes()
    assert b"\r" not in raw
    assert load_record(path) == record


def test_dump_validates_by_default(tmp_path):
    record = make_record(hunks=[])
    with pytest.raises(SchemaError):
        dump_record(record, tmp_path / "bad.json")
    assert not (tmp_path / "bad.json").exists()


# --------------------------------------------------------------------------
# R2's golden fixtures validate against the executable schema — the tie that
# keeps eval/golden/*.json and inplain/schema.py from drifting apart.


@pytest.mark.parametrize(
    "path", sorted(GOLDEN_DIR.glob("*.json")), ids=lambda p: p.stem
)
def test_every_golden_hunk_matches_executable_schema(path):
    entry = json.loads(path.read_text(encoding="utf-8"))
    assert entry["hunks"], f"{path.stem}: golden entry without hunks"
    for hunk in entry["hunks"]:
        validate_hunk(hunk, where=f"{path.stem}/{hunk.get('id')}")


def test_golden_hunk_key_constant_matches_r2s_key_set():
    assert schema.HUNK_KEYS == {
        "id",
        "old_start",
        "new_start",
        "context_before",
        "removed",
        "added",
        "context_after",
        "word_spans",
    }


# ------------------------------------------------------------------ catalog


def _company(**overrides):
    entry = {"slug": "x", "name": "X", "policy_urls": {"privacy": "https://x.test/privacy"}}
    return {**entry, **overrides}


def test_the_real_catalog_loads():
    catalog = schema.load_catalog(Path(__file__).resolve().parents[1] / "catalog.json")
    assert sum(len(entry["policy_urls"]) for entry in catalog) == 52


@pytest.mark.parametrize(
    "entry",
    [
        _company(slug="../x"),
        _company(slug="a/b"),
        _company(slug="."),
        _company(slug="x\n"),
        _company(slug="X"),
        _company(name=""),
        _company(policy_urls={}),
        _company(policy_urls={"../privacy": "https://x.test/privacy"}),
        _company(policy_urls={"privacy": "javascript:alert(1)"}),
        _company(policy_urls={"privacy": "http://x.test/privacy"}),
        _company(policy_urls={"privacy": "https:///privacy"}),
        _company(policy_urls={"privacy": 42}),
    ],
)
def test_a_catalog_entry_that_could_escape_a_path_or_an_href_is_refused(tmp_path, entry):
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps([entry]), encoding="utf-8")
    with pytest.raises(ValueError, match=r"catalog\[0\]"):
        schema.load_catalog(path)
