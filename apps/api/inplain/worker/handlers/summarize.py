from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.diffs import Diff
from inplain.db.models.documents import Document
from inplain.db.models.enums import JobQueue, JobStatus, SummaryStatus
from inplain.db.models.jobs import Job
from inplain.settings import settings

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_PROMPT_VERSION = 1
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

    if not settings.openrouter_api_key:
        change_event.summary_status = SummaryStatus.failed
        change_event.summary_error = "OPENROUTER_API_KEY not set"
        change_event.summary_prompt_version = _PROMPT_VERSION
        db.add(change_event)
        _enqueue_notify(db=db, doc=doc, change_event_id=change_event.id)
        return

    prompt = _build_prompt(diff_hunks=diff.diff_hunks)

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

    _validate_citations(diff_hunks=diff.diff_hunks, bullets=what_changed + why_matters)

    change_event.summary_status = SummaryStatus.completed
    change_event.summary_what_changed = what_changed
    change_event.summary_why_matters = why_matters
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


def _validate_citations(*, diff_hunks: list[dict[str, Any]], bullets: list[Any]) -> None:
    by_id: dict[str, str] = {}
    for h in diff_hunks:
        hid = str(h.get("hunkId") or "")
        added = "".join(h.get("added") or [])
        removed = "".join(h.get("removed") or [])
        by_id[hid] = added + "\n" + removed

    for bullet in bullets:
        if not isinstance(bullet, dict):
            raise ValueError("invalid bullet")
        citations = bullet.get("citations")
        if not isinstance(citations, list) or not citations:
            raise ValueError("missing citations")
        for c in citations:
            if not isinstance(c, dict):
                raise ValueError("invalid citation")
            hid = str(c.get("hunkId") or "")
            quote = str(c.get("quote") or "")
            if not hid or hid not in by_id:
                raise ValueError("invalid hunkId")
            if not quote or quote not in by_id[hid]:
                raise ValueError("invalid quote")
