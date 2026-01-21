from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from inplain.api.deps import get_current_user
from inplain.api.schemas import APIModel
from inplain.db.models.documents import Document
from inplain.db.models.entities import Entity
from inplain.db.models.enums import (
    DocumentDocType,
    DocumentStatus,
    FetchMode,
    JobStatus,
    JobType,
    ScheduleTier,
    UserRole,
)
from inplain.db.models.jobs import Job
from inplain.db.models.users import User
from inplain.db.session import get_db
from inplain.entitlements.limits import force_render_allowed, schedule_tier_allowed
from inplain.entitlements.service import ensure_entitlement
from inplain.settings import settings
from inplain.url_canonicalization import canonicalize_url
from inplain.worker.celery_app import celery_app

router = APIRouter(prefix="/v1")


class DocumentCreateIn(APIModel):
    url: str
    doc_type: DocumentDocType = Field(alias="docType")
    schedule_tier: ScheduleTier = Field(alias="scheduleTier")
    fetch_mode: FetchMode = Field(default=FetchMode.auto, alias="fetchMode")


class JobOut(APIModel):
    job_id: uuid.UUID = Field(alias="jobId")
    status: JobStatus


class DocumentOut(APIModel):
    id: uuid.UUID
    url: str
    status: DocumentStatus
    robots_status: str = Field(alias="robotsStatus")
    next_due_at: datetime = Field(alias="nextDueAt")
    initial_job: JobOut | None = Field(default=None, alias="initialJob")


class DocumentListItem(APIModel):
    id: uuid.UUID
    url: str
    doc_type: DocumentDocType = Field(alias="docType")
    status: DocumentStatus
    robots_status: str = Field(alias="robotsStatus")
    next_due_at: datetime = Field(alias="nextDueAt")
    last_checked_at: datetime | None = Field(alias="lastCheckedAt")
    last_change_event_id: uuid.UUID | None = Field(alias="lastChangeEventId")
    created_at: datetime = Field(alias="createdAt")


class DocumentListOut(APIModel):
    items: list[DocumentListItem]
    next_cursor: str | None = Field(alias="nextCursor")


class PauseIn(APIModel):
    paused: bool


class CheckNowOut(APIModel):
    job_id: uuid.UUID = Field(alias="jobId")
    status: JobStatus


def _encode_cursor(created_at: datetime, document_id: uuid.UUID) -> str:
    return f"{created_at.isoformat()}::{document_id}"


def _decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    raw_dt, raw_id = cursor.split("::", maxsplit=1)
    return datetime.fromisoformat(raw_dt), uuid.UUID(raw_id)


@router.get("/entities/{entity_id}/documents", response_model=DocumentListOut)
def list_documents(
    entity_id: uuid.UUID = Path(alias="entityId"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
) -> DocumentListOut:
    entity = db.execute(
        select(Entity).where(Entity.id == entity_id, Entity.user_id == user.id)
    ).scalar_one_or_none()
    if entity is None:
        raise HTTPException(
            status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Entity not found."}}
        )

    stmt = select(Document).where(
        Document.user_id == user.id,
        Document.entity_id == entity.id,
        Document.deleted_at.is_(None),
    )
    if cursor:
        cursor_created_at, cursor_id = _decode_cursor(cursor)
        stmt = stmt.where(
            or_(
                Document.created_at < cursor_created_at,
                and_(Document.created_at == cursor_created_at, Document.id < cursor_id),
            )
        )

    stmt = stmt.order_by(Document.created_at.desc(), Document.id.desc()).limit(limit + 1)
    rows = list(db.execute(stmt).scalars().all())

    next_cursor: str | None = None
    if len(rows) > limit:
        last = rows[limit - 1]
        next_cursor = _encode_cursor(last.created_at, last.id)
        rows = rows[:limit]

    return DocumentListOut(
        items=[
            DocumentListItem(
                id=r.id,
                url=r.url,
                doc_type=r.doc_type,
                status=r.status,
                robots_status=r.robots_status.value,
                next_due_at=r.next_due_at,
                last_checked_at=r.last_checked_at,
                last_change_event_id=r.last_change_event_id,
                created_at=r.created_at,
            )
            for r in rows
        ],
        next_cursor=next_cursor,
    )


@router.get("/documents/{document_id}", response_model=DocumentListItem)
def get_document(
    document_id: uuid.UUID = Path(alias="documentId"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentListItem:
    doc = db.execute(
        select(Document).where(
            Document.id == document_id, Document.user_id == user.id, Document.deleted_at.is_(None)
        )
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Document not found."}},
        )

    return DocumentListItem(
        id=doc.id,
        url=doc.url,
        doc_type=doc.doc_type,
        status=doc.status,
        robots_status=doc.robots_status.value,
        next_due_at=doc.next_due_at,
        last_checked_at=doc.last_checked_at,
        last_change_event_id=doc.last_change_event_id,
        created_at=doc.created_at,
    )


@router.post("/entities/{entity_id}/documents", response_model=DocumentOut)
def create_document(
    entity_id: uuid.UUID = Path(alias="entityId"),
    payload: DocumentCreateIn = ...,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentOut:
    if user.role != UserRole.admin:
        raise HTTPException(
            status_code=403,
            detail={
                "error": {
                    "code": "CUSTOM_TRACKING_DISABLED",
                    "message": "Custom URL tracking is disabled. Track curated companies instead.",
                }
            },
        )

    return _create_document_impl(entity_id=entity_id, payload=payload, db=db, user=user)


def _create_document_impl(
    entity_id: uuid.UUID,
    payload: DocumentCreateIn,
    db: Session,
    user: User,
) -> DocumentOut:
    entity = db.execute(
        select(Entity).where(Entity.id == entity_id, Entity.user_id == user.id)
    ).scalar_one_or_none()
    if entity is None:
        raise HTTPException(
            status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Entity not found."}}
        )

    entitlement = ensure_entitlement(db, user.id)

    limit_docs = entitlement.limits.get("tracked_documents")
    if isinstance(limit_docs, int):
        current_docs = db.execute(
            select(func.count())
            .select_from(Document)
            .where(Document.user_id == user.id, Document.deleted_at.is_(None))
        ).scalar_one()
        if current_docs >= limit_docs:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": {
                        "code": "DOCUMENT_LIMIT_EXCEEDED",
                        "message": "You've reached your tracked documents limit.",
                        "details": {
                            "current": current_docs,
                            "limit": limit_docs,
                            "tier": entitlement.plan.value,
                        },
                    }
                },
            )

    max_frequency = entitlement.limits.get("schedule_frequency")
    if not isinstance(max_frequency, str) or not schedule_tier_allowed(
        max_frequency, payload.schedule_tier
    ):
        raise HTTPException(
            status_code=403,
            detail={
                "error": {
                    "code": "SCHEDULE_TIER_NOT_ALLOWED",
                    "message": "Your plan does not allow this schedule tier.",
                    "details": {
                        "tier": entitlement.plan.value,
                        "requested": payload.schedule_tier.value,
                        "maxAllowed": max_frequency,
                    },
                }
            },
        )

    js_render_limit = entitlement.limits.get("js_render_fetches_per_month")
    js_render_limit_int = js_render_limit if isinstance(js_render_limit, int) else None
    if not force_render_allowed(js_render_limit_int, payload.fetch_mode):
        raise HTTPException(
            status_code=403,
            detail={
                "error": {
                    "code": "RENDER_NOT_ALLOWED",
                    "message": "Your plan does not include JS-rendered fetches.",
                    "details": {"tier": entitlement.plan.value},
                }
            },
        )

    canonical = canonicalize_url(payload.url)
    existing = db.execute(
        select(Document).where(
            Document.user_id == user.id,
            Document.url_canonical == canonical,
            Document.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "DOCUMENT_ALREADY_EXISTS",
                    "message": "Document is already being tracked.",
                    "details": {
                        "documentId": str(existing.id),
                        "entityId": str(existing.entity_id),
                    },
                }
            },
        )
    now = datetime.now(UTC)

    doc = Document(
        user_id=user.id,
        entity_id=entity.id,
        url=payload.url,
        url_canonical=canonical,
        doc_type=payload.doc_type,
        status=DocumentStatus.active,
        fetch_mode=payload.fetch_mode,
        schedule_tier=payload.schedule_tier,
        next_due_at=now + _schedule_delta(payload.schedule_tier),
    )
    db.add(doc)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        existing = db.execute(
            select(Document).where(
                Document.user_id == user.id,
                Document.url_canonical == canonical,
                Document.deleted_at.is_(None),
            )
        ).scalar_one_or_none()
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "DOCUMENT_ALREADY_EXISTS",
                    "message": "Document is already being tracked.",
                    "details": {
                        "documentId": str(existing.id) if existing else None,
                        "entityId": str(existing.entity_id) if existing else None,
                    },
                }
            },
        ) from None

    job = Job(
        user_id=user.id,
        document_id=doc.id,
        job_type=JobType.fetch,
        status=JobStatus.queued,
    )
    db.add(job)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.execute(
            select(Document).where(
                Document.user_id == user.id,
                Document.url_canonical == canonical,
                Document.deleted_at.is_(None),
            )
        ).scalar_one_or_none()
        if existing is not None:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": {
                        "code": "DOCUMENT_ALREADY_EXISTS",
                        "message": "Document is already being tracked.",
                        "details": {
                            "documentId": str(existing.id),
                            "entityId": str(existing.entity_id),
                        },
                    }
                },
            ) from None
        raise
    db.refresh(doc)
    db.refresh(job)

    if settings.enqueue_jobs:
        locked = db.execute(
            select(Job).where(Job.id == job.id).with_for_update()
        ).scalar_one_or_none()
        should_enqueue = (
            locked is not None
            and locked.status == JobStatus.queued
            and locked.celery_task_id is None
        )
        if should_enqueue:
            async_result = celery_app.send_task(
                "inplain.worker.tasks.run_job",
                args=[str(locked.id)],
                queue=locked.job_type.value,
            )
            locked.celery_task_id = async_result.id
            db.add(locked)
            db.commit()
            db.refresh(job)

    return DocumentOut(
        id=doc.id,
        url=doc.url,
        status=doc.status,
        robots_status=doc.robots_status.value,
        next_due_at=doc.next_due_at,
        initial_job=JobOut(job_id=job.id, status=job.status),
    )


@router.post("/documents/{document_id}/pause")
def pause_document(
    document_id: uuid.UUID = Path(alias="documentId"),
    payload: PauseIn = ...,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    doc = db.execute(
        select(Document).where(
            Document.id == document_id, Document.user_id == user.id, Document.deleted_at.is_(None)
        )
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Document not found."}},
        )

    doc.status = DocumentStatus.paused if payload.paused else DocumentStatus.active
    db.add(doc)
    db.commit()

    return {"status": doc.status.value}


@router.post("/documents/{document_id}/check-now", response_model=CheckNowOut)
def check_now(
    document_id: uuid.UUID = Path(alias="documentId"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CheckNowOut:
    doc = db.execute(
        select(Document).where(
            Document.id == document_id, Document.user_id == user.id, Document.deleted_at.is_(None)
        )
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Document not found."}},
        )

    job = Job(
        user_id=user.id,
        document_id=doc.id,
        job_type=JobType.fetch,
        status=JobStatus.queued,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    if settings.enqueue_jobs:
        locked = db.execute(
            select(Job).where(Job.id == job.id).with_for_update()
        ).scalar_one_or_none()
        should_enqueue = (
            locked is not None
            and locked.status == JobStatus.queued
            and locked.celery_task_id is None
        )
        if should_enqueue:
            async_result = celery_app.send_task(
                "inplain.worker.tasks.run_job",
                args=[str(locked.id)],
                queue=locked.job_type.value,
            )
            locked.celery_task_id = async_result.id
            db.add(locked)
            db.commit()
            db.refresh(job)

    return CheckNowOut(job_id=job.id, status=job.status)


def _schedule_delta(tier: ScheduleTier) -> timedelta:
    match tier:
        case ScheduleTier.daily:
            return timedelta(days=1)
        case ScheduleTier.six_h:
            return timedelta(hours=6)
        case ScheduleTier.one_h:
            return timedelta(hours=1)
