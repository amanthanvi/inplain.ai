from __future__ import annotations

import uuid
from datetime import UTC, datetime
from difflib import SequenceMatcher
from typing import Any

from diff_match_patch import diff_match_patch
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.diffs import Diff
from inplain.db.models.documents import Document
from inplain.db.models.enums import DiffClassification, JobQueue, JobStatus, SummaryStatus
from inplain.db.models.jobs import Job
from inplain.db.models.snapshots import Snapshot


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
    classification = _classify_change(change_score)

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


def _classify_change(change_score: float) -> DiffClassification:
    if change_score >= 0.2:
        return DiffClassification.major
    if change_score >= 0.02:
        return DiffClassification.meaningful
    return DiffClassification.cosmetic


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

