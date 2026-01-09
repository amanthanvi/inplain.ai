from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.api.deps import get_current_user
from inplain.db.models.documents import Document
from inplain.db.models.entities import Entity
from inplain.db.models.enums import (
    DocumentDocType,
    DocumentStatus,
    FetchMode,
    JobStatus,
    JobType,
    ScheduleTier,
)
from inplain.db.models.jobs import Job
from inplain.db.models.users import User
from inplain.db.session import get_db
from inplain.url_canonicalization import canonicalize_url

router = APIRouter(prefix="/v1")


class DocumentCreateIn(BaseModel):
    url: str
    doc_type: DocumentDocType = Field(alias="docType")
    schedule_tier: ScheduleTier = Field(alias="scheduleTier")
    fetch_mode: FetchMode = Field(default=FetchMode.auto, alias="fetchMode")


class JobOut(BaseModel):
    job_id: uuid.UUID = Field(alias="jobId")
    status: JobStatus


class DocumentOut(BaseModel):
    id: uuid.UUID
    url: str
    status: DocumentStatus
    robots_status: str = Field(alias="robotsStatus")
    next_due_at: datetime = Field(alias="nextDueAt")
    initial_job: JobOut | None = Field(default=None, alias="initialJob")


@router.post("/entities/{entity_id}/documents", response_model=DocumentOut)
def create_document(
    entity_id: uuid.UUID = Path(alias="entityId"),
    payload: DocumentCreateIn = ...,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentOut:
    entity = db.execute(
        select(Entity).where(Entity.id == entity_id, Entity.user_id == user.id)
    ).scalar_one_or_none()
    if entity is None:
        raise HTTPException(
            status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Entity not found."}}
        )

    canonical = canonicalize_url(payload.url)
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
    db.flush()

    job = Job(
        user_id=user.id,
        document_id=doc.id,
        job_type=JobType.fetch,
        status=JobStatus.queued,
    )
    db.add(job)
    db.commit()
    db.refresh(doc)
    db.refresh(job)

    return DocumentOut(
        id=doc.id,
        url=doc.url,
        status=doc.status,
        robots_status=doc.robots_status.value,
        next_due_at=doc.next_due_at,
        initial_job=JobOut(job_id=job.id, status=job.status),
    )


def _schedule_delta(tier: ScheduleTier) -> timedelta:
    match tier:
        case ScheduleTier.daily:
            return timedelta(days=1)
        case ScheduleTier.six_h:
            return timedelta(hours=6)
        case ScheduleTier.one_h:
            return timedelta(hours=1)
