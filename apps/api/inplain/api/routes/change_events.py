from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from inplain.api.deps import get_current_user
from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.diffs import Diff
from inplain.db.models.documents import Document
from inplain.db.models.enums import DiffFormat, SummaryStatus
from inplain.db.models.users import User
from inplain.db.session import get_db


router = APIRouter(prefix="/v1")


class ChangeEventListItem(BaseModel):
    id: uuid.UUID
    created_at: datetime = Field(alias="createdAt")
    title: str
    summary_status: SummaryStatus = Field(alias="summaryStatus")


class ChangeEventListOut(BaseModel):
    items: list[ChangeEventListItem]
    next_cursor: str | None = Field(alias="nextCursor")


class ChangeEventOut(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID = Field(alias="documentId")
    title: str
    created_at: datetime = Field(alias="createdAt")

    summary: dict | None
    diff: dict


def _encode_cursor(created_at: datetime, change_event_id: uuid.UUID) -> str:
    return f"{created_at.isoformat()}::{change_event_id}"


def _decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    raw_dt, raw_id = cursor.split("::", maxsplit=1)
    return datetime.fromisoformat(raw_dt), uuid.UUID(raw_id)


@router.get("/documents/{document_id}/change-events", response_model=ChangeEventListOut)
def list_change_events(
    document_id: uuid.UUID = Path(alias="documentId"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
) -> ChangeEventListOut:
    doc = db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user.id, Document.deleted_at.is_(None))
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Document not found."}})

    stmt = select(ChangeEvent).where(ChangeEvent.document_id == doc.id)
    if cursor:
        cursor_created_at, cursor_id = _decode_cursor(cursor)
        stmt = stmt.where(and_(ChangeEvent.created_at <= cursor_created_at, ChangeEvent.id != cursor_id))

    stmt = stmt.order_by(ChangeEvent.created_at.desc(), ChangeEvent.id.desc()).limit(limit + 1)
    rows = list(db.execute(stmt).scalars().all())

    next_cursor: str | None = None
    if len(rows) > limit:
        last = rows[limit - 1]
        next_cursor = _encode_cursor(last.created_at, last.id)
        rows = rows[:limit]

    return ChangeEventListOut(
        items=[ChangeEventListItem.model_validate(r, from_attributes=True) for r in rows],
        next_cursor=next_cursor,
    )


@router.get("/change-events/{change_event_id}", response_model=ChangeEventOut)
def get_change_event(
    change_event_id: uuid.UUID = Path(alias="changeEventId"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ChangeEventOut:
    stmt = (
        select(ChangeEvent, Document, Diff)
        .join(Document, ChangeEvent.document_id == Document.id)
        .join(Diff, ChangeEvent.diff_id == Diff.id)
        .where(ChangeEvent.id == change_event_id, Document.user_id == user.id, Document.deleted_at.is_(None))
    )
    row = db.execute(stmt).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "ChangeEvent not found."}})

    change_event, document, diff = row

    summary: dict | None = None
    if change_event.summary_status == SummaryStatus.completed:
        summary = {
            "whatChanged": change_event.summary_what_changed,
            "whyItMatters": change_event.summary_why_matters,
            "disclaimer": change_event.summary_disclaimer,
        }
    else:
        summary = {
            "whatChanged": change_event.summary_what_changed,
            "whyItMatters": change_event.summary_why_matters,
            "disclaimer": change_event.summary_disclaimer,
        }

    return ChangeEventOut(
        id=change_event.id,
        document_id=document.id,
        title=change_event.title,
        created_at=change_event.created_at,
        summary=summary,
        diff={
            "format": diff.diff_format.value if isinstance(diff.diff_format, DiffFormat) else str(diff.diff_format),
            "unified": diff.unified_diff,
            "hunks": diff.diff_hunks,
        },
    )
