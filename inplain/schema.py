"""The change-record schema, executable form.

``docs/decisions/G1-word-level-highlighting.md`` is the normative document;
this module is its enforcement. T2 (``inplain.detect``) produces records that
must pass :func:`validate_record`, T3 extends them with a ``summary``, and
T4/T5 consume them. R2's golden set (``eval/golden/*.json``) encodes the same
hunk object shape, and a test ties those fixtures to this module so the two
can never drift apart.

Shape, in one place:

* Hunk keys are EXACTLY ``{id, old_start, new_start, context_before, removed,
  added, context_after, word_spans}``. Context is capped at
  :data:`MAX_CONTEXT_LINES` (3). ``removed`` and ``added`` are strictly
  separate lists — T3's side-aware citation validation depends on that
  separation (SPEC §3). ``word_spans`` is reserved for word-level marks and is
  ALWAYS ``null`` at ``schema_version`` 1 (G1).
* The record id is ``"<company>-<doc>-<shortsha7>"`` derived from the
  immutable document commit, so it is stable once published (T5 depends on
  this).
* ``materiality.reason`` is always recorded — for suppressed records too;
  suppressed means unpublished, never unrecorded (SPEC §7).

Serialization: JSON with sorted keys, two-space indent, UTF-8, LF line
endings, one trailing newline — byte-stable so re-serializing an unchanged
record never dirties the archive.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

SCHEMA_VERSION = 1
_HUNK_ID = re.compile(r"h[0-9]+")
MAX_CONTEXT_LINES = 3
SHORT_SHA_LEN = 7

HUNK_KEYS = frozenset(
    {
        "id",
        "old_start",
        "new_start",
        "context_before",
        "removed",
        "added",
        "context_after",
        "word_spans",
    }
)
MATERIALITY_KEYS = frozenset(
    {
        "material",
        "reason",
        "added_chars",
        "removed_chars",
        "similarity_badge",
        "effective_date_change",
    }
)
RECORD_KEYS = frozenset(
    {
        "schema_version",
        "id",
        "company",
        "company_name",
        "doc",
        "source_url",
        "commit",
        "parent_commit",
        "detected_at",
        "materiality",
        "hunks",
    }
)
OPTIONAL_RECORD_KEYS = frozenset({"summary", "summary_attempts"})

_FULL_SHA = re.compile(r"^[0-9a-f]{40}$")
_DETECTED_AT = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$")
_SLUG = re.compile(r"^[a-z0-9][a-z0-9-]*$")


class SchemaError(ValueError):
    """A record (or fragment) does not match the normative schema."""


def record_id(company: str, doc: str, commit: str) -> str:
    """``"<company>-<doc>-<shortsha7>"`` — stable once published (G1)."""
    return f"{company}-{doc}-{commit[:SHORT_SHA_LEN]}"


# --------------------------------------------------------------------------
# dataclasses — the construction side; validation works on plain dicts so
# fixtures loaded from JSON validate without round-tripping through these.


@dataclass(frozen=True)
class Hunk:
    id: str
    old_start: int
    new_start: int
    context_before: list[str]
    removed: list[str]
    added: list[str]
    context_after: list[str]
    word_spans: None = None  # reserved (G1); always null in v1


@dataclass(frozen=True)
class Materiality:
    material: bool
    reason: str  # ALWAYS recorded, machine-readable (SPEC §7)
    added_chars: int
    removed_chars: int
    similarity_badge: float  # display only, never a gate
    effective_date_change: dict[str, str | None] | None = None  # {"from", "to"}, one side may be null


@dataclass(frozen=True)
class ChangeRecord:
    company: str
    company_name: str
    doc: str
    source_url: str
    commit: str
    parent_commit: str
    detected_at: str
    materiality: Materiality
    hunks: list[Hunk] = field(default_factory=list)
    schema_version: int = SCHEMA_VERSION

    @property
    def id(self) -> str:
        return record_id(self.company, self.doc, self.commit)

    def to_dict(self) -> dict[str, Any]:
        # asdict copies every nested list and dict; ``id`` is a property, not
        # a field. Key order is irrelevant: dumps_record sorts keys.
        return {**asdict(self), "id": self.id}


# --------------------------------------------------------------------------
# validation


def _expect(condition: bool, message: str) -> None:
    if not condition:
        raise SchemaError(message)


def _expect_str_list(value: Any, name: str) -> None:
    _expect(isinstance(value, list), f"{name} must be a list")
    _expect(
        all(isinstance(line, str) for line in value),
        f"{name} must contain only strings",
    )


def validate_hunk(hunk: Any, where: str = "hunk") -> None:
    """One hunk object against the normative shape (G1; mirrors R2's tests)."""
    _expect(isinstance(hunk, dict), f"{where}: must be an object")
    _expect(
        set(hunk) == set(HUNK_KEYS),
        f"{where}: keys must be exactly {sorted(HUNK_KEYS)}, got {sorted(hunk)}",
    )
    _expect(
        isinstance(hunk["id"], str) and _HUNK_ID.fullmatch(hunk["id"]) is not None,
        f"{where}: id must match h<number> (it is a DOM anchor target)",
    )
    for key in ("old_start", "new_start"):
        _expect(
            isinstance(hunk[key], int)
            and not isinstance(hunk[key], bool)
            and hunk[key] >= 1,
            f"{where}: {key} must be a 1-based integer line number",
        )
    for key in ("context_before", "removed", "added", "context_after"):
        _expect_str_list(hunk[key], f"{where}: {key}")
    for key in ("context_before", "context_after"):
        _expect(
            len(hunk[key]) <= MAX_CONTEXT_LINES,
            f"{where}: {key} is capped at {MAX_CONTEXT_LINES} lines",
        )
    _expect(
        bool(hunk["removed"]) or bool(hunk["added"]),
        f"{where}: a hunk must change something",
    )
    _expect(
        hunk["word_spans"] is None,
        f"{where}: word_spans is reserved and must be null at schema_version 1",
    )


def validate_materiality(materiality: Any, where: str = "materiality") -> None:
    _expect(isinstance(materiality, dict), f"{where}: must be an object")
    _expect(
        set(materiality) == set(MATERIALITY_KEYS),
        f"{where}: keys must be exactly {sorted(MATERIALITY_KEYS)}, "
        f"got {sorted(materiality)}",
    )
    _expect(isinstance(materiality["material"], bool), f"{where}: material must be a bool")
    _expect(
        isinstance(materiality["reason"], str) and materiality["reason"] != "",
        f"{where}: reason must ALWAYS be recorded (non-empty string)",
    )
    for key in ("added_chars", "removed_chars"):
        _expect(
            isinstance(materiality[key], int)
            and not isinstance(materiality[key], bool)
            and materiality[key] >= 0,
            f"{where}: {key} must be a non-negative integer",
        )
    badge = materiality["similarity_badge"]
    _expect(
        isinstance(badge, (int, float))
        and not isinstance(badge, bool)
        and 0.0 <= float(badge) <= 1.0,
        f"{where}: similarity_badge must be a number in [0, 1]",
    )
    change = materiality["effective_date_change"]
    if change is not None:
        _expect(
            isinstance(change, dict) and set(change) == {"from", "to"},
            f"{where}: effective_date_change must be null or {{from, to}}",
        )
        _expect(
            all(v is None or (isinstance(v, str) and v) for v in change.values()),
            f"{where}: effective_date_change values must be non-empty strings or null",
        )
        _expect(
            any(v is not None for v in change.values()),
            f"{where}: effective_date_change must carry at least one side",
        )


def validate_record(record: Any) -> None:
    """A full change record against the normative schema. Raises SchemaError.

    A ``summary`` (added by T3) is optional and, when present, only checked
    structurally here — side-aware citation validation is T3's job and runs
    against the hunks, not the schema. ``summary_attempts`` (also T3's) counts
    the summarize runs that failed on an unsummarised record.
    """
    _expect(isinstance(record, dict), "record must be an object")
    keys = set(record)
    missing = set(RECORD_KEYS) - keys
    unexpected = keys - set(RECORD_KEYS) - set(OPTIONAL_RECORD_KEYS)
    _expect(not missing, f"record is missing keys: {sorted(missing)}")
    _expect(not unexpected, f"record has unexpected keys: {sorted(unexpected)}")
    _expect(
        record["schema_version"] == SCHEMA_VERSION,
        f"schema_version must be {SCHEMA_VERSION}",
    )
    for key in ("company", "doc"):
        _expect(
            isinstance(record[key], str) and _SLUG.match(record[key]) is not None,
            f"{key} must be a lowercase slug",
        )
    for key in ("company_name", "source_url"):
        _expect(isinstance(record[key], str), f"{key} must be a string")
    for key in ("commit", "parent_commit"):
        _expect(
            isinstance(record[key], str) and _FULL_SHA.match(record[key]) is not None,
            f"{key} must be a full 40-hex commit sha",
        )
    expected_id = record_id(record["company"], record["doc"], record["commit"])
    _expect(
        record["id"] == expected_id,
        f"id must be {expected_id!r} (\"<company>-<doc>-<shortsha7>\" from the "
        f"document commit), got {record['id']!r}",
    )
    _expect(
        isinstance(record["detected_at"], str)
        and _DETECTED_AT.match(record["detected_at"]) is not None,
        "detected_at must be an ISO-8601 UTC instant ending in Z",
    )
    validate_materiality(record["materiality"])
    _expect(
        isinstance(record["hunks"], list) and len(record["hunks"]) >= 1,
        "hunks must be a non-empty list — a change record records a change",
    )
    seen: set[str] = set()
    for index, hunk in enumerate(record["hunks"]):
        validate_hunk(hunk, where=f"hunks[{index}]")
        _expect(hunk["id"] not in seen, f"hunks[{index}]: duplicate hunk id {hunk['id']!r}")
        seen.add(hunk["id"])
    if "summary" in record:
        _validate_summary(record["summary"], seen)
    if "summary_attempts" in record:
        attempts = record["summary_attempts"]
        _expect(
            type(attempts) is int and attempts >= 1,
            "summary_attempts must be a positive integer",
        )


def _validate_summary(summary: Any, hunk_ids: set[str]) -> None:
    """Structural checks only; AC-3/AC-4 enforcement lives in T3."""
    _expect(isinstance(summary, dict), "summary: must be an object")
    bullets = summary.get("bullets")
    _expect(isinstance(bullets, list), "summary: bullets must be a list")
    for b_index, bullet in enumerate(bullets):
        where = f"summary.bullets[{b_index}]"
        _expect(isinstance(bullet, dict), f"{where}: must be an object")
        _expect(
            isinstance(bullet.get("text"), str) and bullet["text"].strip() != "",
            f"{where}: text must be a non-empty string",
        )
        citations = bullet.get("citations")
        _expect(
            isinstance(citations, list) and len(citations) >= 1,
            f"{where}: every bullet must carry at least one citation",
        )
        for c_index, citation in enumerate(citations):
            c_where = f"{where}.citations[{c_index}]"
            _expect(isinstance(citation, dict), f"{c_where}: must be an object")
            _expect(
                citation.get("hunk") in hunk_ids,
                f"{c_where}: hunk must name a hunk in this record",
            )
            _expect(
                citation.get("side") in ("added", "removed"),
                f"{c_where}: side must be 'added' or 'removed'",
            )
            _expect(
                isinstance(citation.get("quote"), str) and citation["quote"] != "",
                f"{c_where}: quote must be a non-empty string",
            )


# --------------------------------------------------------------------------
# JSON — sorted keys, LF, trailing newline: byte-stable serialization.


def dumps_record(record: dict[str, Any]) -> str:
    return json.dumps(record, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def dump_record(record: dict[str, Any], path: Path) -> None:
    """Validate in full, then replace atomically — the one record writer.

    Validation happens before anything touches the destination, and the
    replacement is a single ``os.replace`` from a sibling temp file, so a
    failure at any point leaves the original record byte-identical and valid,
    and never leaves a truncated file for detect's ledger to trust.
    """
    validate_record(record)
    text = dumps_record(record)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.{os.getpid()}.tmp")
    try:
        tmp.write_text(text, encoding="utf-8", newline="\n")
        os.replace(tmp, path)
    finally:
        if tmp.exists():
            tmp.unlink()


def load_record(path: Path) -> dict[str, Any]:
    record = json.loads(Path(path).read_text(encoding="utf-8"))
    validate_record(record)
    return record


# --------------------------------------------------------------------------
# catalog — the one loader of catalog.json, for crawl, site, feeds and detect.


def load_catalog(path: Path) -> list[dict[str, Any]]:
    """catalog.json, validated once for every reader.

    ``slug`` and each ``policy_urls`` key become path components
    (``documents/<slug>/<doc>.txt``, ``_site/companies/<slug>/``) and URL
    segments, so both must be whole lowercase slugs: no separator, dot or
    empty component can reach a path. Document URLs reach the crawler and the
    site's ``href``s, so they must be https with a host.
    """
    try:
        entries = json.loads(Path(path).read_text(encoding="utf-8"))
    except OSError as exc:
        raise ValueError(f"cannot read catalog {path}: {exc}") from exc
    except ValueError as exc:
        raise ValueError(f"catalog {path} is not valid JSON: {exc}") from exc
    if not isinstance(entries, list):
        raise ValueError("catalog must be a JSON array of companies")
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise ValueError(f"catalog[{index}]: must be an object")
        if not isinstance(entry.get("slug"), str) or not _SLUG.fullmatch(entry["slug"]):
            raise ValueError(f"catalog[{index}]: slug must be a lowercase slug")
        # The name and URLs are written as lines of the Snapshot commit message,
        # which detect parses back: a line break in either could forge one.
        name = entry.get("name")
        if not isinstance(name, str) or not name or not name.isprintable():
            raise ValueError(f"catalog[{index}]: name must be a non-empty, one-line string")
        urls = entry.get("policy_urls")
        if not isinstance(urls, dict) or not urls:
            raise ValueError(f"catalog[{index}]: policy_urls must be a non-empty object")
        for doc, url in urls.items():
            if not _SLUG.fullmatch(doc):
                raise ValueError(f"catalog[{index}]: document {doc!r} must be a lowercase slug")
            if not _is_https_url(url):
                raise ValueError(f"catalog[{index}]: {doc} URL must be https, with no spaces")
    return entries


def _is_https_url(url: Any) -> bool:
    # isprintable() rejects every whitespace but the space, which urlsplit
    # would otherwise strip or keep silently.
    if not isinstance(url, str) or not url.isprintable() or " " in url:
        return False
    try:
        parts = urlsplit(url)
        return parts.scheme == "https" and bool(parts.hostname)
    except ValueError:  # e.g. an unbalanced IPv6 bracket
        return False
