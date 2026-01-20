from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any, Literal

import httpx
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.diffs import Diff
from inplain.db.models.documents import Document
from inplain.db.models.entitlements import Entitlement
from inplain.db.models.enums import JobStatus, JobType, Provider, ProviderAction, SummaryStatus
from inplain.db.models.jobs import Job
from inplain.db.models.provider_usage import ProviderUsage
from inplain.settings import settings

_PROMPT_VERSION = 1
_DISCLAIMER = "This summary is informational and not legal advice."


class Citation(BaseModel):
    hunk_id: str = Field(alias="hunkId")
    quote: str
    side: Literal["added", "removed"]


class SummaryBullet(BaseModel):
    text: str
    citations: list[Citation]
    citation_invalid: bool = Field(default=False, alias="citationInvalid")


class SummaryV1(BaseModel):
    what_changed: list[SummaryBullet] = Field(alias="what_changed")
    why_it_matters: list[SummaryBullet] = Field(alias="why_it_matters")
    disclaimer: str


def run_summarize_job(db: Session, job: Job) -> None:
    if job.document_id is None:
        raise RuntimeError("summarize job missing document_id")

    if not settings.openrouter_api_key:
        _mark_pending_events_failed(db, job.document_id, "OPENROUTER_API_KEY not set")
        return

    doc = db.execute(select(Document).where(Document.id == job.document_id)).scalar_one_or_none()
    if doc is None or doc.deleted_at is not None:
        return

    now = datetime.now(UTC)
    period_key = now.strftime("%Y-%m")
    if not _has_summary_quota(db, user_id=doc.user_id, period_key=period_key):
        change_event_id = _mark_pending_events_skipped_quota(db, doc.id)
        if change_event_id is not None:
            db.commit()
        return

    stmt = (
        select(ChangeEvent, Diff)
        .join(Diff, ChangeEvent.diff_id == Diff.id)
        .where(
            ChangeEvent.document_id == doc.id,
            ChangeEvent.summary_status == SummaryStatus.pending,
        )
        .order_by(ChangeEvent.created_at.asc())
        .limit(1)
    )
    row = db.execute(stmt).one_or_none()
    if row is None:
        return

    change_event, diff = row

    hunks = diff.diff_hunks if isinstance(diff.diff_hunks, list) else []
    hunks_limited = _limit_hunks(hunks)

    model = settings.openrouter_primary_model
    summary_raw, usage = _openrouter_summary(
        model=model,
        payload={
            "document": {
                "url": doc.url,
                "doc_type": doc.doc_type.value,
            },
            "hunks": hunks_limited,
        },
    )

    try:
        summary = SummaryV1.model_validate(summary_raw)
    except ValidationError as e:
        change_event.summary_status = SummaryStatus.failed
        change_event.summary_error = f"invalid summary schema: {e}"
        db.add(change_event)
        db.commit()
        return

    summary = _validate_citations(summary, hunks_limited)
    summary.disclaimer = _ensure_disclaimer(summary.disclaimer)

    change_event.summary_status = SummaryStatus.completed
    change_event.summary_model = model
    change_event.summary_prompt_version = _PROMPT_VERSION
    change_event.summary_what_changed = [b.model_dump(by_alias=True) for b in summary.what_changed]
    change_event.summary_why_matters = [b.model_dump(by_alias=True) for b in summary.why_it_matters]
    change_event.summary_disclaimer = summary.disclaimer
    change_event.summary_error = None

    db.add(change_event)

    db.add(
        ProviderUsage(
            user_id=doc.user_id,
            document_id=doc.id,
            provider=Provider.openrouter,
            action=ProviderAction.summary,
            quantity=1,
            tokens_in=usage.get("prompt_tokens"),
            tokens_out=usage.get("completion_tokens"),
            cost_usd_micros=usage.get("cost_usd_micros"),
            period_key=period_key,
        )
    )

    if settings.enable_email_notifications:
        db.add(
            Job(
                user_id=doc.user_id,
                document_id=doc.id,
                job_type=JobType.notify,
                status=JobStatus.queued,
            )
        )

    db.commit()


def _mark_pending_events_failed(db: Session, document_id: Any, error: str) -> None:
    stmt = (
        select(ChangeEvent)
        .where(
            ChangeEvent.document_id == document_id,
            ChangeEvent.summary_status == SummaryStatus.pending,
        )
        .order_by(ChangeEvent.created_at.asc())
        .limit(5)
    )
    events = list(db.execute(stmt).scalars().all())
    for ev in events:
        ev.summary_status = SummaryStatus.failed
        ev.summary_error = error
        db.add(ev)
    db.commit()


def _has_summary_quota(*, db: Session, user_id: Any, period_key: str) -> bool:
    entitlement = (
        db.execute(select(Entitlement).where(Entitlement.user_id == user_id))
        .scalars()
        .one_or_none()
    )
    limits = entitlement.limits if entitlement is not None else {}

    raw_limit = limits.get("ai_summaries_per_month")
    limit = raw_limit if isinstance(raw_limit, int) else 0
    if limit <= 0:
        return False

    used = (
        db.execute(
            select(func.coalesce(func.sum(ProviderUsage.quantity), 0)).where(
                ProviderUsage.user_id == user_id,
                ProviderUsage.period_key == period_key,
                ProviderUsage.provider == Provider.openrouter,
                ProviderUsage.action == ProviderAction.summary,
            )
        )
        .scalars()
        .one()
    )
    return int(used) < limit


def _mark_pending_events_skipped_quota(db: Session, document_id: Any) -> Any | None:
    stmt = (
        select(ChangeEvent)
        .where(
            ChangeEvent.document_id == document_id,
            ChangeEvent.summary_status == SummaryStatus.pending,
        )
        .order_by(ChangeEvent.created_at.asc())
        .limit(1)
    )
    ev = db.execute(stmt).scalars().one_or_none()
    if ev is None:
        return None

    ev.summary_status = SummaryStatus.skipped_quota
    ev.summary_error = "quota exceeded"
    db.add(ev)
    return ev.id


def _openrouter_summary(
    *, model: str, payload: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, int | None]]:
    url = f"{settings.openrouter_base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://inplain.ai",
        "X-Title": "inplain.ai",
    }

    system = (
        "You summarize changes to a privacy policy / terms document.\n"
        "Use only the provided diff hunks.\n"
        "Return JSON ONLY with keys: what_changed, why_it_matters, disclaimer.\n"
        "Each bullet must include citations with hunkId, quote, side=added|removed.\n"
        f"Always include the disclaimer: {_DISCLAIMER}\n"
    )

    body = {
        "model": model,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
    }

    with httpx.Client(timeout=httpx.Timeout(60.0, connect=10.0)) as client:
        resp = client.post(url, headers=headers, json=body)

    if resp.status_code >= 400:
        raise RuntimeError(f"openrouter error: status {resp.status_code}")

    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    parsed = _parse_json_object(content)

    usage_raw = data.get("usage") or {}
    usage = {
        "prompt_tokens": _int_or_none(usage_raw.get("prompt_tokens")),
        "completion_tokens": _int_or_none(usage_raw.get("completion_tokens")),
        "cost_usd_micros": _int_or_none(usage_raw.get("cost_usd_micros")),
    }

    return parsed, usage


def _parse_json_object(text: str) -> dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise RuntimeError("model did not return json")

    snippet = text[start : end + 1]
    return json.loads(snippet)


def _int_or_none(value: Any) -> int | None:
    if isinstance(value, int):
        return value
    return None


def _limit_hunks(hunks: list[dict]) -> list[dict]:
    scored: list[tuple[int, dict]] = []
    for h in hunks:
        added = h.get("added") or []
        removed = h.get("removed") or []
        score = sum(len(s) for s in added) + sum(len(s) for s in removed)
        scored.append((score, h))

    scored.sort(key=lambda t: t[0], reverse=True)
    top = [h for _, h in scored[:20]]

    limited: list[dict] = []
    for h in top:
        limited.append(
            {
                "hunkId": h.get("hunkId"),
                "context": h.get("context") or "",
                "added": list((h.get("added") or [])[:40]),
                "removed": list((h.get("removed") or [])[:40]),
            }
        )

    return limited


def _validate_citations(summary: SummaryV1, hunks: list[dict]) -> SummaryV1:
    hunk_map: dict[str, dict[str, list[str]]] = {}
    for h in hunks:
        hunk_id = h.get("hunkId")
        if not isinstance(hunk_id, str):
            continue
        hunk_map[hunk_id] = {
            "added": list(h.get("added") or []),
            "removed": list(h.get("removed") or []),
        }

    for bullet in summary.what_changed + summary.why_it_matters:
        valid: list[Citation] = []
        invalid = False
        for c in bullet.citations:
            lines = hunk_map.get(c.hunk_id, {}).get(c.side, [])
            if any(c.quote in line for line in lines):
                valid.append(c)
            else:
                invalid = True

        if invalid or not valid:
            bullet.citation_invalid = True
        bullet.citations = valid

    return summary


def _ensure_disclaimer(disclaimer: str) -> str:
    if "not legal advice" in disclaimer.lower():
        return disclaimer
    return _DISCLAIMER
