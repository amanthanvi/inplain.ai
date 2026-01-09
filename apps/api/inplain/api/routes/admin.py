from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from inplain.api.deps import require_admin
from inplain.auth.clerk import update_user_public_metadata
from inplain.db.models.entitlements import Entitlement
from inplain.db.models.enums import JobStatus, JobType, Plan, UserStatus
from inplain.db.models.jobs import Job
from inplain.db.models.users import User
from inplain.db.session import get_db
from inplain.entitlements.defaults import default_limits
from inplain.entitlements.service import ensure_entitlement
from inplain.settings import settings
from inplain.worker.celery_app import celery_app

router = APIRouter(prefix="/v1/admin")


class JobListItem(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None = Field(alias="userId")
    document_id: uuid.UUID | None = Field(alias="documentId")
    job_type: JobType = Field(alias="jobType")
    status: JobStatus
    attempt: int
    max_attempts: int = Field(alias="maxAttempts")
    celery_task_id: str | None = Field(alias="celeryTaskId")
    error: str | None
    created_at: datetime = Field(alias="createdAt")


class JobListOut(BaseModel):
    items: list[JobListItem]
    next_cursor: str | None = Field(alias="nextCursor")


class RetryJobOut(BaseModel):
    job_id: uuid.UUID = Field(alias="jobId")
    status: JobStatus


class BanUserIn(BaseModel):
    banned: bool


class SetPlanIn(BaseModel):
    plan: Plan


def _encode_cursor(created_at: datetime, job_id: uuid.UUID) -> str:
    return f"{created_at.isoformat()}::{job_id}"


def _decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    raw_dt, raw_id = cursor.split("::", maxsplit=1)
    return datetime.fromisoformat(raw_dt), uuid.UUID(raw_id)


@router.get("/jobs", response_model=JobListOut)
def list_jobs(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
    status_filter: JobStatus | None = Query(default=None, alias="status"),
    job_type_filter: JobType | None = Query(default=None, alias="jobType"),
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = Query(default=None),
) -> JobListOut:
    stmt = select(Job)

    if status_filter is not None:
        stmt = stmt.where(Job.status == status_filter)
    if job_type_filter is not None:
        stmt = stmt.where(Job.job_type == job_type_filter)
    if cursor:
        cursor_created_at, cursor_id = _decode_cursor(cursor)
        stmt = stmt.where(
            or_(
                Job.created_at < cursor_created_at,
                and_(Job.created_at == cursor_created_at, Job.id < cursor_id),
            )
        )

    stmt = stmt.order_by(Job.created_at.desc(), Job.id.desc()).limit(limit + 1)
    rows = list(db.execute(stmt).scalars().all())

    next_cursor: str | None = None
    if len(rows) > limit:
        last = rows[limit - 1]
        next_cursor = _encode_cursor(last.created_at, last.id)
        rows = rows[:limit]

    return JobListOut(
        items=[JobListItem.model_validate(r, from_attributes=True) for r in rows],
        next_cursor=next_cursor,
    )


@router.post("/jobs/{job_id}/retry", response_model=RetryJobOut)
def retry_job(
    job_id: uuid.UUID = Path(alias="jobId"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> RetryJobOut:
    job = db.execute(select(Job).where(Job.id == job_id)).scalars().one_or_none()
    if job is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Job not found."}},
        )

    job.status = JobStatus.queued
    job.attempt = 0
    job.error = None
    job.celery_task_id = None
    job.started_at = None
    job.finished_at = None
    db.add(job)
    db.commit()
    db.refresh(job)

    if settings.enqueue_jobs:
        async_result = celery_app.send_task(
            "inplain.worker.tasks.run_job",
            args=[str(job.id)],
            queue=job.job_type.value,
        )
        job.celery_task_id = async_result.id
        db.add(job)
        db.commit()
        db.refresh(job)

    return RetryJobOut(job_id=job.id, status=job.status)


@router.post("/users/{user_id}/ban")
def ban_user(
    user_id: uuid.UUID = Path(alias="userId"),
    payload: BanUserIn = ...,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict[str, str]:
    user = db.execute(select(User).where(User.id == user_id)).scalars().one_or_none()
    if user is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "User not found."}},
        )

    user.status = UserStatus.banned if payload.banned else UserStatus.active
    db.add(user)
    db.commit()
    return {"status": user.status.value}


@router.post("/users/{user_id}/plan")
def set_user_plan(
    user_id: uuid.UUID = Path(alias="userId"),
    payload: SetPlanIn = ...,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict[str, str]:
    user = db.execute(select(User).where(User.id == user_id)).scalars().one_or_none()
    if user is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "User not found."}},
        )

    entitlement: Entitlement = ensure_entitlement(db, user.id)
    entitlement.plan = payload.plan
    entitlement.limits = default_limits(payload.plan)
    entitlement.period_start_at = datetime.now(UTC)
    entitlement.period_end_at = None
    db.add(entitlement)

    if not settings.clerk_secret_key:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={
                "error": {
                    "code": "CLERK_NOT_CONFIGURED",
                    "message": "Clerk secret key not configured.",
                }
            },
        )

    update_user_public_metadata(
        user.clerk_user_id,
        {"plan": payload.plan.value, "limits": entitlement.limits, "period_end_at": None},
    )

    db.commit()
    return {"plan": payload.plan.value}
