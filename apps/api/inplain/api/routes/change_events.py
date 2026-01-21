from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import Field
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from inplain.api.deps import get_current_user
from inplain.api.schemas import APIModel
from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.diffs import Diff
from inplain.db.models.documents import Document
from inplain.db.models.entitlements import Entitlement
from inplain.db.models.enums import DiffFormat, Plan, SummaryStatus
from inplain.db.models.users import User
from inplain.db.session import get_db
from inplain.entitlements.defaults import default_limits

router = APIRouter(prefix="/v1")


class ChangeEventListItem(APIModel):
    id: uuid.UUID
    created_at: datetime = Field(alias="createdAt")
    title: str
    summary_status: SummaryStatus = Field(alias="summaryStatus")


class ChangeEventListOut(APIModel):
    items: list[ChangeEventListItem]
    next_cursor: str | None = Field(alias="nextCursor")


class ChangeEventOut(APIModel):
    id: uuid.UUID
    document_id: uuid.UUID = Field(alias="documentId")
    title: str
    created_at: datetime = Field(alias="createdAt")

    summary: dict | None
    diff: dict


class DocumentExportOut(APIModel):
    document_id: uuid.UUID = Field(alias="documentId")
    exported_at: datetime = Field(alias="exportedAt")
    events: list[ChangeEventOut]


def _encode_cursor(created_at: datetime, change_event_id: uuid.UUID) -> str:
    return f"{created_at.isoformat()}::{change_event_id}"


def _decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    raw_dt, raw_id = cursor.split("::", maxsplit=1)
    return datetime.fromisoformat(raw_dt), uuid.UUID(raw_id)


def _export_mode_for_user(db: Session, user: User) -> str:
    entitlement = (
        db.execute(select(Entitlement).where(Entitlement.user_id == user.id))
        .scalars()
        .one_or_none()
    )
    limits = entitlement.limits if entitlement is not None else default_limits(Plan.free)
    return str(limits.get("export") or "last_10_events")


def _build_change_event_out(
    change_event: ChangeEvent, document: Document, diff: Diff
) -> ChangeEventOut:
    summary: dict | None = None
    if change_event.summary_status == SummaryStatus.completed:
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
            "format": diff.diff_format.value
            if isinstance(diff.diff_format, DiffFormat)
            else str(diff.diff_format),
            "unified": diff.unified_diff,
            "hunks": diff.diff_hunks,
        },
    )


@router.get("/documents/{document_id}/change-events", response_model=ChangeEventListOut)
def list_change_events(
    document_id: uuid.UUID = Path(alias="documentId"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
) -> ChangeEventListOut:
    doc = db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.user_id == user.id,
            Document.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Document not found."}},
        )

    export_mode = _export_mode_for_user(db, user)
    if export_mode != "full":
        cursor = None
        limit = min(limit, 10)

    stmt = select(ChangeEvent).where(ChangeEvent.document_id == doc.id)
    if cursor and export_mode == "full":
        cursor_created_at, cursor_id = _decode_cursor(cursor)
        stmt = stmt.where(
            or_(
                ChangeEvent.created_at < cursor_created_at,
                and_(
                    ChangeEvent.created_at == cursor_created_at,
                    ChangeEvent.id < cursor_id,
                ),
            )
        )

    stmt = stmt.order_by(ChangeEvent.created_at.desc(), ChangeEvent.id.desc()).limit(limit + 1)
    rows = list(db.execute(stmt).scalars().all())

    next_cursor: str | None = None
    if export_mode == "full" and len(rows) > limit:
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
        .where(
            ChangeEvent.id == change_event_id,
            Document.user_id == user.id,
            Document.deleted_at.is_(None),
        )
    )
    row = db.execute(stmt).one_or_none()
    if row is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "ChangeEvent not found."}},
        )

    change_event, document, diff = row

    return _build_change_event_out(change_event, document, diff)


@router.get("/change-events/{change_event_id}/export", response_model=ChangeEventOut)
def export_change_event(
    change_event_id: uuid.UUID = Path(alias="changeEventId"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ChangeEventOut:
    stmt = (
        select(ChangeEvent, Document, Diff)
        .join(Document, ChangeEvent.document_id == Document.id)
        .join(Diff, ChangeEvent.diff_id == Diff.id)
        .where(
            ChangeEvent.id == change_event_id,
            Document.user_id == user.id,
            Document.deleted_at.is_(None),
        )
    )
    row = db.execute(stmt).one_or_none()
    if row is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "ChangeEvent not found."}},
        )

    change_event, document, diff = row

    export_mode = _export_mode_for_user(db, user)
    if export_mode != "full":
        allowed_ids = set(
            db.execute(
                select(ChangeEvent.id)
                .where(ChangeEvent.document_id == document.id)
                .order_by(ChangeEvent.created_at.desc(), ChangeEvent.id.desc())
                .limit(10)
            ).scalars()
        )
        if change_event.id not in allowed_ids:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": {
                        "code": "EXPORT_NOT_ALLOWED",
                        "message": "Export is not available for this change event on your plan.",
                    }
                },
            )

    return _build_change_event_out(change_event, document, diff)


@router.get("/documents/{document_id}/export", response_model=DocumentExportOut)
def export_document_history(
    document_id: uuid.UUID = Path(alias="documentId"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentExportOut:
    doc = db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.user_id == user.id,
            Document.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Document not found."}},
        )

    export_mode = _export_mode_for_user(db, user)
    limit = 10 if export_mode != "full" else 2000

    rows = list(
        db.execute(
            select(ChangeEvent, Diff)
            .join(Diff, ChangeEvent.diff_id == Diff.id)
            .where(ChangeEvent.document_id == doc.id)
            .order_by(ChangeEvent.created_at.desc(), ChangeEvent.id.desc())
            .limit(limit)
        ).all()
    )
    events = [_build_change_event_out(ev, doc, diff) for ev, diff in rows]

    return DocumentExportOut(
        document_id=doc.id,
        exported_at=datetime.now(UTC),
        events=events,
    )
