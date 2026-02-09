from __future__ import annotations

import json
import re
import uuid
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
_PROMPT_VERSION = 1
_MAX_HUNKS_FOR_LLM = 20
_FUZZY_REPAIR_MIN_RATIO = 0.82
_MODEL_CHAIN = [
    "anthropic/claude-sonnet-4-5",
    "openai/gpt-5.2",
    "google/gemini-3-flash",
]


def run_summarize_job(db: Session, *, job: Job) -> None:
    payload = job.payload or {}
    change_event_id = payload.get("change_event_id")
    if not change_event_id:
        raise ValueError("summarize job missing change_event_id")

    ce_uuid = uuid.UUID(str(change_event_id))
    change_event = db.execute(select(ChangeEvent).where(ChangeEvent.id == ce_uuid)).scalar_one()
    doc = db.execute(select(Document).where(Document.id == change_event.document_id)).scalar_one()
    diff = db.execute(select(Diff).where(Diff.id == change_event.diff_id)).scalar_one()

    if _over_summary_quota(db=db, clerk_user_id=doc.clerk_user_id, schedule_tier=doc.schedule_tier):
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

    llm_hunks = diff.diff_hunks[:_MAX_HUNKS_FOR_LLM]
    prompt = _build_prompt(diff_hunks=llm_hunks)

    summary: dict[str, Any] | None = None
    model_used: str | None = None
    last_error: str | None = None
    for model in _MODEL_CHAIN:
        try:
            summary = _call_openrouter(model=model, prompt=prompt)
            model_used = model
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

    validated_what_changed = _validate_citations(diff_hunks=diff.diff_hunks, bullets=what_changed)
    validated_why_matters = _validate_citations(diff_hunks=diff.diff_hunks, bullets=why_matters)

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


def _build_prompt(*, diff_hunks: list[dict[str, Any]]) -> str:
    return (
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
        "- No legal advice; informational only.\n"
        "\n"
        f"DIFF_HUNKS:\n{json.dumps(diff_hunks, ensure_ascii=False)}"
    )


def _call_openrouter(*, model: str, prompt: str) -> dict[str, Any]:
    headers = {
        "authorization": f"Bearer {settings.openrouter_api_key}",
        "content-type": "application/json",
    }
    body = {
        "model": model,
        "messages": [
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }
    with httpx.Client(timeout=60) as client:
        resp = client.post(_OPENROUTER_URL, headers=headers, json=body)
        resp.raise_for_status()
        data = resp.json()

    content = data["choices"][0]["message"]["content"]
    if not isinstance(content, str):
        raise ValueError("unexpected OpenRouter response")
    return json.loads(content)


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


def _over_summary_quota(*, db: Session, clerk_user_id: str, schedule_tier: ScheduleTier) -> bool:
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
            ChangeEvent.summary_status.in_([SummaryStatus.completed, SummaryStatus.failed]),
        )
    ).scalar_one()
    return int(used or 0) >= limit
