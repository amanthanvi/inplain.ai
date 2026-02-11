from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.api.deps import get_clerk_user_id, get_db
from inplain.api.schemas import ChangeEventDetailOut, ChangeEventOut, DiffOut
from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.diffs import Diff
from inplain.db.models.documents import Document
from inplain.db.models.enums import JobQueue, JobStatus, SummaryStatus
from inplain.db.models.jobs import Job
from inplain.telemetry import capture_event

router = APIRouter(tags=["internal.change_events"])


@router.get("/change-events", response_model=list[ChangeEventOut])
def list_change_events(
    clerk_user_id: str = Depends(get_clerk_user_id),
    db: Session = Depends(get_db),
) -> list[ChangeEventOut]:
    stmt = (
        select(ChangeEvent)
        .join(Document, Document.id == ChangeEvent.document_id)
        .where(Document.clerk_user_id == clerk_user_id, Document.deleted_at.is_(None))
        .order_by(ChangeEvent.created_at.desc())
        .limit(200)
    )
    events = list(db.execute(stmt).scalars().all())
    return [ChangeEventOut.model_validate(e, from_attributes=True) for e in events]


@router.get("/change-events/{change_event_id}", response_model=ChangeEventDetailOut)
def get_change_event(
    change_event_id: uuid.UUID,
    clerk_user_id: str = Depends(get_clerk_user_id),
    db: Session = Depends(get_db),
) -> ChangeEventDetailOut:
    stmt = (
        select(ChangeEvent)
        .join(Document, Document.id == ChangeEvent.document_id)
        .where(
            ChangeEvent.id == change_event_id,
            Document.clerk_user_id == clerk_user_id,
            Document.deleted_at.is_(None),
        )
    )
    event = db.execute(stmt).scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=404, detail="not found")

    diff = db.execute(select(Diff).where(Diff.id == event.diff_id)).scalar_one()
    capture_event(
        distinct_id=clerk_user_id,
        event="change_event_viewed",
        properties={"change_event_id": str(event.id), "document_id": str(event.document_id)},
    )
    return ChangeEventDetailOut(
        change_event=ChangeEventOut.model_validate(event, from_attributes=True),
        diff=DiffOut.model_validate(diff, from_attributes=True),
    )


@router.post("/change-events/{change_event_id}/retry-summary")
def retry_change_event_summary(
    change_event_id: uuid.UUID,
    clerk_user_id: str = Depends(get_clerk_user_id),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    stmt = (
        select(ChangeEvent)
        .join(Document, Document.id == ChangeEvent.document_id)
        .where(
            ChangeEvent.id == change_event_id,
            Document.clerk_user_id == clerk_user_id,
            Document.deleted_at.is_(None),
        )
    )
    event = db.execute(stmt).scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=404, detail="not found")

    if event.summary_status != SummaryStatus.failed:
        raise HTTPException(status_code=400, detail="summary not retryable")

    existing = db.execute(
        select(Job.id).where(
            Job.queue == JobQueue.summarize,
            Job.status.in_([JobStatus.queued, JobStatus.running]),
            Job.payload["change_event_id"].astext == str(change_event_id),
        )
    ).scalar_one_or_none()
    if existing is not None:
        return {"ok": True}

    now = datetime.now(UTC)
    event.summary_status = SummaryStatus.pending
    event.summary_error = None
    event.summary_model = None
    event.summary_what_changed = None
    event.summary_why_matters = None
    db.add(event)

    db.add(
        Job(
            queue=JobQueue.summarize,
            clerk_user_id=clerk_user_id,
            document_id=event.document_id,
            status=JobStatus.queued,
            run_at=now,
            payload={"change_event_id": str(change_event_id)},
            max_attempts=3,
        )
    )
    db.commit()
    return {"ok": True}
