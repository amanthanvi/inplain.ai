from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from difflib import SequenceMatcher
from typing import Any

import httpx
from diff_match_patch import diff_match_patch
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.diffs import Diff
from inplain.db.models.documents import Document
from inplain.db.models.enums import DiffClassification, JobQueue, JobStatus, SummaryStatus
from inplain.db.models.jobs import Job
from inplain.db.models.snapshots import Snapshot
from inplain.settings import settings

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_CLASSIFY_PROMPT_VERSION = 1
_CLASSIFY_MODEL_CHAIN = [
    "z-ai/glm-4.7-flash",
    "minimax/minimax-m2.1",
    "google/gemini-2.5-flash-lite",
]
_MAX_HUNKS_FOR_CLASSIFY = 12

_CLASSIFY_RESPONSE_FORMAT: dict[str, Any] = {
    "type": "json_schema",
    "json_schema": {
        "name": f"inplain_classify_v{_CLASSIFY_PROMPT_VERSION}",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "meaningful": {"type": "boolean"},
                "reason": {"type": "string"},
            },
            "required": ["meaningful", "reason"],
        },
    },
}

_AMBIGUOUS_CHANGE_SCORE_MIN = 0.02
_AMBIGUOUS_CHANGE_SCORE_MAX = 0.08
_AMBIGUOUS_CHANGED_CHARS_MAX = 2500
_MEANINGFUL_CHANGED_CHARS_MIN = 500


def run_diff_job(db: Session, *, job: Job) -> None:
    if job.document_id is None:
        raise ValueError("diff job missing document_id")

    payload = job.payload or {}
    from_snapshot_id = payload.get("from_snapshot_id")
    to_snapshot_id = payload.get("to_snapshot_id")
    if not from_snapshot_id or not to_snapshot_id:
        raise ValueError("diff job missing snapshot ids")

    from_uuid = uuid.UUID(str(from_snapshot_id))
    to_uuid = uuid.UUID(str(to_snapshot_id))

    existing = db.execute(
        select(Diff.id).where(Diff.from_snapshot_id == from_uuid, Diff.to_snapshot_id == to_uuid)
    ).scalar_one_or_none()
    if existing is not None:
        return

    doc = db.execute(select(Document).where(Document.id == job.document_id)).scalar_one()
    old = db.execute(select(Snapshot).where(Snapshot.id == from_uuid)).scalar_one()
    new = db.execute(select(Snapshot).where(Snapshot.id == to_uuid)).scalar_one()

    dmp = diff_match_patch()
    diffs = dmp.diff_main(old.extracted_text, new.extracted_text)
    dmp.diff_cleanupSemantic(diffs)

    hunks = _diffs_to_hunks(diffs=diffs, context_chars=200)

    ratio = SequenceMatcher(None, old.extracted_text, new.extracted_text).ratio()
    change_score = max(0.0, min(1.0, 1.0 - ratio))
    changed_chars = sum(len(t) for op, t in diffs if op != 0)
    classification = _classify_change(change_score=change_score, changed_chars=changed_chars)

    if classification != DiffClassification.cosmetic and _is_ambiguous_change(
        change_score=change_score, changed_chars=changed_chars
    ):
        decision = _llm_classify_meaningful(
            diff_hunks=hunks[:_MAX_HUNKS_FOR_CLASSIFY],
            doc_type=doc.doc_type.value,
        )
        if decision is not None and not decision.meaningful:
            classification = DiffClassification.cosmetic

    diff = Diff(
        document_id=doc.id,
        from_snapshot_id=from_uuid,
        to_snapshot_id=to_uuid,
        diff_hunks=hunks,
        change_score=change_score,
        change_classification=classification,
    )
    db.add(diff)
    db.flush()

    if classification == DiffClassification.cosmetic:
        return

    title = _default_title(doc.doc_type.value)
    change_event = ChangeEvent(
        document_id=doc.id,
        diff_id=diff.id,
        title=title,
        summary_status=SummaryStatus.pending,
    )
    db.add(change_event)
    db.flush()

    now = datetime.now(UTC)
    db.add(
        Job(
            queue=JobQueue.summarize,
            clerk_user_id=doc.clerk_user_id,
            document_id=doc.id,
            status=JobStatus.queued,
            run_at=now,
            payload={"change_event_id": str(change_event.id)},
        )
    )


def _classify_change(*, change_score: float, changed_chars: int) -> DiffClassification:
    if change_score >= 0.2:
        return DiffClassification.major
    if change_score >= 0.02 or changed_chars >= _MEANINGFUL_CHANGED_CHARS_MIN:
        return DiffClassification.meaningful
    return DiffClassification.cosmetic


def _is_ambiguous_change(*, change_score: float, changed_chars: int) -> bool:
    return (
        _AMBIGUOUS_CHANGE_SCORE_MIN <= change_score <= _AMBIGUOUS_CHANGE_SCORE_MAX
        and changed_chars <= _AMBIGUOUS_CHANGED_CHARS_MAX
    )


@dataclass(frozen=True)
class _MeaningfulDecision:
    meaningful: bool
    reason: str
    model: str
    prompt_version: int


def _llm_classify_meaningful(
    *,
    diff_hunks: list[dict[str, Any]],
    doc_type: str,
) -> _MeaningfulDecision | None:
    if not settings.openrouter_api_key:
        return None

    prompt = _build_classify_prompt(diff_hunks=diff_hunks, doc_type=doc_type)

    last_error: str | None = None
    for model in _CLASSIFY_MODEL_CHAIN:
        try:
            data = _call_openrouter(model=model, prompt=prompt, max_tokens=220)
            meaningful = data.get("meaningful")
            reason = data.get("reason")
            if not isinstance(meaningful, bool) or not isinstance(reason, str):
                raise ValueError("invalid classify response")
            return _MeaningfulDecision(
                meaningful=meaningful,
                reason=reason.strip(),
                model=model,
                prompt_version=_CLASSIFY_PROMPT_VERSION,
            )
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)

    if last_error:
        return None
    return None


def _build_classify_prompt(*, diff_hunks: list[dict[str, Any]], doc_type: str) -> str:
    return (
        "You are classifying whether a change in a policy document is meaningful to users.\n"
        "Return ONLY valid JSON with this shape:\n"
        '{ "meaningful": boolean, "reason": string }\n'
        "\n"
        "Guidance:\n"
        "- meaningful=true for changes to data collection/usage/sharing, retention, user rights,\n"
        "  consent, arbitration, liability, enforcement, termination, or material obligations.\n"
        "- meaningful=false for pure formatting, whitespace, navigation/link-only changes,\n"
        "  tracking pixels, or date-only updates like 'Last updated'.\n"
        "- If uncertain, default to meaningful=true.\n"
        "\n"
        f"DOC_TYPE: {doc_type}\n"
        f"DIFF_HUNKS:\n{json.dumps(diff_hunks, ensure_ascii=False)}"
    )


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
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.0,
        "response_format": _CLASSIFY_RESPONSE_FORMAT,
    }
    if max_tokens is not None:
        body["max_tokens"] = int(max_tokens)

    with httpx.Client(timeout=30) as client:
        resp = client.post(_OPENROUTER_URL, headers=headers, json=body)

        if resp.status_code == 400 and body.get("response_format") is not None:
            fallback = dict(body)
            fallback.pop("response_format", None)
            resp = client.post(_OPENROUTER_URL, headers=headers, json=fallback)

        resp.raise_for_status()
        data = resp.json()

    content = data["choices"][0]["message"]["content"]
    if not isinstance(content, str):
        raise ValueError("unexpected OpenRouter response")
    return json.loads(content)


def _diffs_to_hunks(*, diffs: list[tuple[int, str]], context_chars: int) -> list[dict[str, Any]]:
    hunks: list[dict[str, Any]] = []
    hunk_num = 1
    i = 0
    while i < len(diffs):
        op, text = diffs[i]
        if op == 0:
            i += 1
            continue

        before = ""
        if i > 0 and diffs[i - 1][0] == 0:
            before = diffs[i - 1][1][-context_chars:]

        added: list[str] = []
        removed: list[str] = []
        while i < len(diffs) and diffs[i][0] != 0:
            op_i, text_i = diffs[i]
            if op_i == 1:
                added.append(text_i)
            elif op_i == -1:
                removed.append(text_i)
            i += 1

        after = ""
        if i < len(diffs) and diffs[i][0] == 0:
            after = diffs[i][1][:context_chars]

        hunks.append(
            {
                "hunkId": f"h{hunk_num}",
                "contextBefore": before,
                "contextAfter": after,
                "added": added,
                "removed": removed,
            }
        )
        hunk_num += 1

    return hunks


def _default_title(doc_type: str) -> str:
    match doc_type:
        case "privacy":
            return "Privacy Policy updated"
        case "tos":
            return "Terms of Service updated"
        case "cookie":
            return "Cookie Policy updated"
        case _:
            return "Policy updated"
