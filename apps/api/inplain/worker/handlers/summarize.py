from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from difflib import SequenceMatcher
from typing import Any

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.diffs import Diff
from inplain.db.models.documents import Document
from inplain.db.models.enums import JobQueue, JobStatus, ScheduleTier, SummaryStatus
from inplain.db.models.jobs import Job
from inplain.settings import settings

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_PROMPT_VERSION = 2
_MAX_HUNKS_FOR_LLM = 20
_MAX_PROMPT_CHARS = 45_000
_MAX_HUNK_PART_CHARS = 1_200
_MAX_PARTS_PER_HUNK = 8
_FUZZY_REPAIR_MIN_RATIO = 0.82

_SUMMARY_CITATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "hunkId": {"type": "string"},
        "quote": {"type": "string"},
    },
    "required": ["hunkId", "quote"],
}

_SUMMARY_BULLET_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "text": {"type": "string"},
        "citations": {
            "type": "array",
            "items": _SUMMARY_CITATION_SCHEMA,
            "minItems": 1,
        },
    },
    "required": ["text", "citations"],
}

_SUMMARY_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "what_changed": {
            "type": "array",
            "items": _SUMMARY_BULLET_SCHEMA,
        },
        "why_matters": {
            "type": "array",
            "items": _SUMMARY_BULLET_SCHEMA,
        },
    },
    "required": ["what_changed", "why_matters"],
}

_SUMMARY_RESPONSE_FORMAT: dict[str, Any] = {
    "type": "json_schema",
    "json_schema": {
        "name": f"inplain_summary_v{_PROMPT_VERSION}",
        "strict": True,
        "schema": _SUMMARY_JSON_SCHEMA,
    },
}


@dataclass(frozen=True)
class _SummaryPolicy:
    model_chain: list[str]
    max_tokens: int
    max_bullets: int


def _summary_policy_for_tier(tier: ScheduleTier) -> _SummaryPolicy:
    match tier:
        case ScheduleTier.daily:
            return _SummaryPolicy(
                model_chain=[
                    "deepseek/deepseek-v3.2",
                    "google/gemini-2.5-flash-lite",
                ],
                max_tokens=500,
                max_bullets=6,
            )
        case ScheduleTier.six_h:
            return _SummaryPolicy(
                model_chain=[
                    "deepseek/deepseek-v3.2",
                    "openai/gpt-4o-mini",
                    "openai/gpt-4.1-mini",
                ],
                max_tokens=750,
                max_bullets=8,
            )
        case ScheduleTier.one_h:
            return _SummaryPolicy(
                model_chain=[
                    "deepseek/deepseek-v3.2",
                    "openai/gpt-4.1-mini",
                    "openai/gpt-5.2",
                    "anthropic/claude-sonnet-4.5",
                ],
                max_tokens=950,
                max_bullets=10,
            )
        case _:
            return _SummaryPolicy(
                model_chain=[
                    "deepseek/deepseek-v3.2",
                    "google/gemini-2.5-flash-lite",
                ],
                max_tokens=500,
                max_bullets=6,
            )


def run_summarize_job(db: Session, *, job: Job) -> None:
    payload = job.payload or {}
    change_event_id = payload.get("change_event_id")
    if not change_event_id:
        raise ValueError("summarize job missing change_event_id")

    ce_uuid = uuid.UUID(str(change_event_id))
    change_event = db.execute(
        select(ChangeEvent).where(ChangeEvent.id == ce_uuid)
    ).scalar_one()
    doc = db.execute(
        select(Document).where(Document.id == change_event.document_id)
    ).scalar_one()
    diff = db.execute(select(Diff).where(Diff.id == change_event.diff_id)).scalar_one()

    if _over_summary_quota(
        db=db, clerk_user_id=doc.clerk_user_id, schedule_tier=doc.schedule_tier
    ):
        change_event.summary_status = SummaryStatus.skipped_quota
        change_event.summary_error = "summary quota exceeded"
        change_event.summary_prompt_version = _PROMPT_VERSION
        db.add(change_event)
        _enqueue_notify(db=db, doc=doc, change_event_id=change_event.id)
        return

    if not settings.openrouter_api_key:
        change_event.summary_status = SummaryStatus.failed
        change_event.summary_error = "OPENROUTER_API_KEY not set"
        change_event.summary_prompt_version = _PROMPT_VERSION
        db.add(change_event)
        _enqueue_notify(db=db, doc=doc, change_event_id=change_event.id)
        return

    policy = _summary_policy_for_tier(doc.schedule_tier)
    prompt = _build_prompt(diff_hunks=diff.diff_hunks, max_bullets=policy.max_bullets)

    summary: dict[str, Any] | None = None
    model_used: str | None = None
    last_error: str | None = None
    for model in policy.model_chain:
        model_used = model
        try:
            summary = _call_openrouter(model=model, prompt=prompt, max_tokens=policy.max_tokens)
            break
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)

    if not summary:
        change_event.summary_status = SummaryStatus.failed
        change_event.summary_error = last_error or "summary failed"
        change_event.summary_model = model_used
        change_event.summary_prompt_version = _PROMPT_VERSION
        db.add(change_event)
        _enqueue_notify(db=db, doc=doc, change_event_id=change_event.id)
        return

    what_changed = summary.get("what_changed")
    why_matters = summary.get("why_matters")
    if not isinstance(what_changed, list) or not isinstance(why_matters, list):
        raise ValueError("invalid summary shape")

    validated_what_changed = _validate_citations(
        diff_hunks=diff.diff_hunks, bullets=what_changed
    )
    validated_why_matters = _validate_citations(
        diff_hunks=diff.diff_hunks, bullets=why_matters
    )

    change_event.summary_status = SummaryStatus.completed
    change_event.summary_what_changed = validated_what_changed
    change_event.summary_why_matters = validated_why_matters
    change_event.summary_model = model_used
    change_event.summary_prompt_version = _PROMPT_VERSION
    change_event.summary_error = None
    db.add(change_event)

    _enqueue_notify(db=db, doc=doc, change_event_id=change_event.id)


def _enqueue_notify(db: Session, *, doc: Document, change_event_id: uuid.UUID) -> None:
    now = datetime.now(UTC)
    db.add(
        Job(
            queue=JobQueue.notify,
            clerk_user_id=doc.clerk_user_id,
            document_id=doc.id,
            status=JobStatus.queued,
            run_at=now,
            payload={"change_event_id": str(change_event_id)},
        )
    )


def _build_prompt(*, diff_hunks: list[dict[str, Any]], max_bullets: int = 10) -> str:
    max_bullets = max(1, min(20, int(max_bullets)))
    prefix = (
        "You are summarizing privacy/ToS diffs.\n"
        "Return ONLY valid JSON with this shape:\n"
        "{\n"
        '  "what_changed": [\n'
        '    {"text": string, "citations": [{"hunkId": string, "quote": string}]}\n'
        "  ],\n"
        '  "why_matters": [\n'
        '    {"text": string, "citations": [{"hunkId": string, "quote": string}]}\n'
        "  ]\n"
        "}\n"
        "Rules:\n"
        "- Every bullet MUST have >=1 citation.\n"
        "- quote MUST be an exact substring from the referenced hunk's added/removed text.\n"
        "- Only cite quotes that appear in the provided DIFF_HUNKS.\n"
        "- No legal advice; informational only.\n"
        f"- Write at most {max_bullets} bullets in what_changed and at most {max_bullets} "
        "bullets in why_matters.\n"
        "- Prefer the most user-impactful changes; avoid repetition.\n"
        "- Keep each bullet concise (<= 180 characters).\n"
        "\n"
        "DIFF_HUNKS:\n"
    )

    selected: list[dict[str, Any]] = []
    for raw in diff_hunks[:_MAX_HUNKS_FOR_LLM]:
        trimmed = _trim_hunk_for_prompt(raw)
        candidate = [*selected, trimmed]
        prompt = prefix + json.dumps(candidate, ensure_ascii=False)
        if len(prompt) > _MAX_PROMPT_CHARS:
            break
        selected = candidate

    if not selected and diff_hunks:
        # Extremely large hunk: fall back to a more aggressive trim so the job can still run.
        selected = [
            _trim_hunk_for_prompt(diff_hunks[0], max_part_chars=400, max_parts=4)
        ]

    return prefix + json.dumps(selected, ensure_ascii=False)


def _trim_hunk_for_prompt(
    hunk: dict[str, Any],
    *,
    max_part_chars: int = _MAX_HUNK_PART_CHARS,
    max_parts: int = _MAX_PARTS_PER_HUNK,
) -> dict[str, Any]:
    hid = str(hunk.get("hunkId") or "")
    context_before = hunk.get("contextBefore")
    context_after = hunk.get("contextAfter")
    added = hunk.get("added")
    removed = hunk.get("removed")

    return {
        "hunkId": hid,
        "contextBefore": context_before if isinstance(context_before, str) else "",
        "contextAfter": context_after if isinstance(context_after, str) else "",
        "added": _trim_text_parts(
            added, max_part_chars=max_part_chars, max_parts=max_parts
        ),
        "removed": _trim_text_parts(
            removed, max_part_chars=max_part_chars, max_parts=max_parts
        ),
    }


def _trim_text_parts(
    parts: object,
    *,
    max_part_chars: int,
    max_parts: int,
) -> list[str]:
    if not isinstance(parts, list) or max_parts <= 0:
        return []

    out: list[str] = []
    for part in parts:
        if not isinstance(part, str) or not part:
            continue

        if len(part) <= max_part_chars:
            out.append(part)
        else:
            head = part[:max_part_chars]
            tail = part[-max_part_chars:]
            out.append(head)
            if len(out) < max_parts and tail and tail != head:
                out.append(tail)

        if len(out) >= max_parts:
            break

    return out


def _call_openrouter(*, model: str, prompt: str, max_tokens: int | None = None) -> dict[str, Any]:
    headers = {
        "authorization": f"Bearer {settings.openrouter_api_key}",
        "content-type": "application/json",
        "HTTP-Referer": settings.openrouter_http_referer,
        "X-Title": settings.openrouter_x_title,
    }
    body: dict[str, Any] = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "You are a careful assistant that outputs ONLY valid JSON.",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.0,
        "response_format": _SUMMARY_RESPONSE_FORMAT,
    }
    if max_tokens is not None:
        body["max_tokens"] = int(max_tokens)

    with httpx.Client(timeout=60) as client:
        resp = client.post(_OPENROUTER_URL, headers=headers, json=body)

        if resp.status_code == 400 and body.get("response_format") is not None:
            # Some providers may reject response_format; retry once without it.
            fallback = dict(body)
            fallback.pop("response_format", None)
            resp = client.post(_OPENROUTER_URL, headers=headers, json=fallback)

        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = _openrouter_error_detail(exc.response)
            raise RuntimeError(
                f"OpenRouter {exc.response.status_code}: {detail or exc.response.reason_phrase}"
            ) from exc

        data = resp.json()

    content = data["choices"][0]["message"]["content"]
    if not isinstance(content, str):
        raise ValueError("unexpected OpenRouter response")
    return _parse_json_object(content)


def _openrouter_error_detail(resp: httpx.Response) -> str:
    try:
        payload = resp.json()
    except Exception:  # noqa: BLE001
        text = (resp.text or "").strip().replace("\n", " ")
        return text[:300]

    if not isinstance(payload, dict):
        return ""

    error = payload.get("error")
    if isinstance(error, dict):
        msg = error.get("message")
        if isinstance(msg, str):
            return msg.strip()[:300]
    if isinstance(error, str):
        return error.strip()[:300]

    msg = payload.get("message")
    if isinstance(msg, str):
        return msg.strip()[:300]

    return ""


def _parse_json_object(text: str) -> dict[str, Any]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```[a-zA-Z0-9_-]*\n?", "", cleaned)
            cleaned = re.sub(r"\n?```$", "", cleaned).strip()

        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            data = json.loads(cleaned[start : end + 1])
        else:
            raise ValueError("OpenRouter returned non-JSON output") from exc

    if not isinstance(data, dict):
        raise ValueError("OpenRouter returned non-object JSON")
    return data


def _normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def _repair_quote(*, quote: str, hunk_text: str) -> str | None:
    if not quote:
        return None

    stripped_quote = quote.strip()
    if stripped_quote and stripped_quote in hunk_text:
        return stripped_quote

    escaped = re.escape(stripped_quote)
    whitespace_tolerant = re.sub(r"\\\s+", r"\\s+", escaped)
    if whitespace_tolerant:
        match = re.search(whitespace_tolerant, hunk_text, flags=re.IGNORECASE)
        if match:
            return match.group(0)

    target = _normalize_spaces(stripped_quote).lower()
    if not target:
        return None

    chunks = [chunk.strip() for chunk in hunk_text.splitlines() if chunk.strip()]
    if not chunks and hunk_text.strip():
        chunks = [hunk_text.strip()]
    if not chunks:
        return None

    best_chunk: str | None = None
    best_ratio = 0.0
    for chunk in chunks:
        ratio = SequenceMatcher(None, target, _normalize_spaces(chunk).lower()).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_chunk = chunk

    if best_chunk and best_ratio >= _FUZZY_REPAIR_MIN_RATIO:
        return best_chunk
    return None


def _validate_citations(
    *,
    diff_hunks: list[dict[str, Any]],
    bullets: list[Any],
) -> list[dict[str, Any]]:
    by_id: dict[str, str] = {}
    for h in diff_hunks:
        hid = str(h.get("hunkId") or "")
        added = "".join(h.get("added") or [])
        removed = "".join(h.get("removed") or [])
        by_id[hid] = added + "\n" + removed

    validated_bullets: list[dict[str, Any]] = []
    for bullet in bullets:
        if not isinstance(bullet, dict):
            raise ValueError("invalid bullet")
        citations = bullet.get("citations")
        if not isinstance(citations, list) or not citations:
            raise ValueError("missing citations")

        validated_citations: list[dict[str, str]] = []
        for c in citations:
            if not isinstance(c, dict):
                raise ValueError("invalid citation")
            hid = str(c.get("hunkId") or "")
            quote = str(c.get("quote") or "")
            status = "valid"

            hunk_text = by_id.get(hid)
            if hunk_text is None:
                status = "unverified"
            elif not quote or quote not in hunk_text:
                repaired = _repair_quote(quote=quote, hunk_text=hunk_text)
                if repaired:
                    quote = repaired
                    status = "repaired"
                else:
                    status = "unverified"

            validated_citations.append(
                {
                    "hunkId": hid,
                    "quote": quote,
                    "status": status,
                }
            )

        validated_bullet = dict(bullet)
        validated_bullet["citations"] = validated_citations
        validated_bullets.append(validated_bullet)

    return validated_bullets


def _over_summary_quota(
    *, db: Session, clerk_user_id: str, schedule_tier: ScheduleTier
) -> bool:
    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    match schedule_tier:
        case ScheduleTier.daily:
            limit = 10
        case ScheduleTier.six_h:
            limit = 500
        case ScheduleTier.one_h:
            limit = 5000
        case _:
            limit = 10

    used = db.execute(
        select(func.count(ChangeEvent.id))
        .join(Document, Document.id == ChangeEvent.document_id)
        .where(
            Document.clerk_user_id == clerk_user_id,
            ChangeEvent.created_at >= month_start,
            ChangeEvent.summary_status.in_(
                [SummaryStatus.completed, SummaryStatus.failed]
            ),
        )
    ).scalar_one()
    return int(used or 0) >= limit
