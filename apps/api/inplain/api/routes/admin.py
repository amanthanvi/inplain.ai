from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from inplain.api.deps import require_admin
from inplain.auth.clerk import update_user_public_metadata
from inplain.db.models.audit_logs import AuditLog
from inplain.db.models.documents import Document
from inplain.db.models.entitlements import Entitlement
from inplain.db.models.enums import (
    JobStatus,
    JobType,
    Plan,
    Provider,
    ProviderAction,
    UserRole,
    UserStatus,
)
from inplain.db.models.jobs import Job
from inplain.db.models.provider_usage import ProviderUsage
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


class UserListItem(BaseModel):
    id: uuid.UUID
    clerk_user_id: str = Field(alias="clerkUserId")
    email: str
    role: UserRole
    status: UserStatus
    plan: Plan
    limits: dict
    created_at: datetime = Field(alias="createdAt")


class UserListOut(BaseModel):
    items: list[UserListItem]
    next_cursor: str | None = Field(alias="nextCursor")


class AbuseUserItem(BaseModel):
    user_id: uuid.UUID = Field(alias="userId")
    email: str
    checks: int


class AbuseHostItem(BaseModel):
    host: str
    failures: int


class AbuseOut(BaseModel):
    window_hours: int = Field(alias="windowHours")
    top_users: list[AbuseUserItem] = Field(alias="topUsers")
    top_failing_hosts: list[AbuseHostItem] = Field(alias="topFailingHosts")


class LlmDailyItem(BaseModel):
    day: str
    requests: int
    tokens_in: int = Field(alias="tokensIn")
    tokens_out: int = Field(alias="tokensOut")
    cost_usd_micros: int = Field(alias="costUsdMicros")


class LlmTopUserItem(BaseModel):
    user_id: uuid.UUID = Field(alias="userId")
    email: str
    requests: int
    tokens_in: int = Field(alias="tokensIn")
    tokens_out: int = Field(alias="tokensOut")
    cost_usd_micros: int = Field(alias="costUsdMicros")


class LlmUsageOut(BaseModel):
    window_days: int = Field(alias="windowDays")
    daily: list[LlmDailyItem]
    top_users: list[LlmTopUserItem] = Field(alias="topUsers")


def _encode_cursor(created_at: datetime, job_id: uuid.UUID) -> str:
    return f"{created_at.isoformat()}::{job_id}"


def _decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    raw_dt, raw_id = cursor.split("::", maxsplit=1)
    return datetime.fromisoformat(raw_dt), uuid.UUID(raw_id)


def _write_audit_log(
    db: Session,
    *,
    actor: User,
    action: str,
    target_type: str,
    target_id: str,
    metadata: dict,
    request: Request | None = None,
) -> None:
    ip = request.client.host if request and request.client else None
    user_agent = request.headers.get("user-agent") if request else None

    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            metadata_=metadata,
            ip=ip,
            user_agent=user_agent,
        )
    )


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
    request: Request,
    job_id: uuid.UUID = Path(alias="jobId"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> RetryJobOut:
    job = db.execute(select(Job).where(Job.id == job_id)).scalars().one_or_none()
    if job is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Job not found."}},
        )

    prev_status = job.status
    prev_attempt = job.attempt

    job.status = JobStatus.queued
    job.attempt = 0
    job.error = None
    job.celery_task_id = None
    job.started_at = None
    job.finished_at = None
    if settings.enqueue_jobs:
        async_result = celery_app.send_task(
            "inplain.worker.tasks.run_job",
            args=[str(job.id)],
            queue=job.job_type.value,
        )
        job.celery_task_id = async_result.id

    _write_audit_log(
        db,
        actor=admin,
        action="job.retry",
        target_type="job",
        target_id=str(job.id),
        metadata={
            "job_type": job.job_type.value,
            "previous_status": prev_status.value,
            "previous_attempt": prev_attempt,
        },
        request=request,
    )

    db.add(job)
    db.commit()
    db.refresh(job)

    return RetryJobOut(job_id=job.id, status=job.status)


@router.post("/users/{user_id}/ban")
def ban_user(
    request: Request,
    user_id: uuid.UUID = Path(alias="userId"),
    payload: BanUserIn = ...,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict[str, str]:
    user = db.execute(select(User).where(User.id == user_id)).scalars().one_or_none()
    if user is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "User not found."}},
        )

    prev_status = user.status
    user.status = UserStatus.banned if payload.banned else UserStatus.active
    db.add(user)

    _write_audit_log(
        db,
        actor=admin,
        action="user.ban" if payload.banned else "user.unban",
        target_type="user",
        target_id=str(user.id),
        metadata={"previous_status": prev_status.value, "status": user.status.value},
        request=request,
    )

    db.commit()
    return {"status": user.status.value}


@router.post("/users/{user_id}/plan")
def set_user_plan(
    request: Request,
    user_id: uuid.UUID = Path(alias="userId"),
    payload: SetPlanIn = ...,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict[str, str]:
    user = db.execute(select(User).where(User.id == user_id)).scalars().one_or_none()
    if user is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "User not found."}},
        )

    entitlement: Entitlement = ensure_entitlement(db, user.id)
    prev_plan = entitlement.plan
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

    _write_audit_log(
        db,
        actor=admin,
        action="user.set_plan",
        target_type="user",
        target_id=str(user.id),
        metadata={"previous_plan": prev_plan.value, "plan": payload.plan.value},
        request=request,
    )

    db.commit()
    return {"plan": payload.plan.value}


@router.get("/users", response_model=UserListOut)
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
    query: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = Query(default=None),
) -> UserListOut:
    stmt = select(User, Entitlement).outerjoin(Entitlement, Entitlement.user_id == User.id)

    if query:
        q = query.strip()
        if q:
            clauses = [User.email.ilike(f"%{q}%"), User.clerk_user_id.ilike(f"%{q}%")]
            try:
                user_id = uuid.UUID(q)
            except ValueError:
                user_id = None
            if user_id is not None:
                clauses.append(User.id == user_id)
            stmt = stmt.where(or_(*clauses))

    if cursor:
        cursor_created_at, cursor_id = _decode_cursor(cursor)
        stmt = stmt.where(
            or_(
                User.created_at < cursor_created_at,
                and_(User.created_at == cursor_created_at, User.id < cursor_id),
            )
        )

    stmt = stmt.order_by(User.created_at.desc(), User.id.desc()).limit(limit + 1)
    rows = list(db.execute(stmt).all())

    next_cursor: str | None = None
    if len(rows) > limit:
        last_user, _ = rows[limit - 1]
        next_cursor = _encode_cursor(last_user.created_at, last_user.id)
        rows = rows[:limit]

    items: list[UserListItem] = []
    for user, entitlement in rows:
        plan = entitlement.plan if entitlement is not None else Plan.free
        limits = (
            entitlement.limits
            if entitlement is not None and isinstance(entitlement.limits, dict)
            else default_limits(plan)
        )
        items.append(
            UserListItem(
                id=user.id,
                clerk_user_id=user.clerk_user_id,
                email=user.email,
                role=user.role,
                status=user.status,
                plan=plan,
                limits=limits,
                created_at=user.created_at,
            )
        )

    return UserListOut(items=items, next_cursor=next_cursor)


@router.get("/abuse", response_model=AbuseOut)
def get_abuse_dashboard(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
    window_hours: int = Query(default=24, ge=1, le=168, alias="windowHours"),
) -> AbuseOut:
    now = datetime.now(UTC)
    cutoff = now - timedelta(hours=window_hours)

    top_users = list(
        db.execute(
            select(
                User.id,
                User.email,
                func.count(Job.id).label("checks"),
            )
            .join(Job, Job.user_id == User.id)
            .where(
                Job.job_type == JobType.fetch,
                Job.user_id.is_not(None),
                Job.created_at >= cutoff,
            )
            .group_by(User.id, User.email)
            .order_by(func.count(Job.id).desc())
            .limit(20)
        ).all()
    )
    user_items = [
        AbuseUserItem(user_id=user_id, email=email, checks=int(checks))
        for user_id, email, checks in top_users
    ]

    host_expr = func.split_part(func.split_part(Document.url, "://", 2), "/", 1)
    failing_hosts = list(
        db.execute(
            select(
                host_expr.label("host"),
                func.count(Job.id).label("failures"),
            )
            .join(Document, Document.id == Job.document_id)
            .where(
                Job.job_type == JobType.fetch,
                Job.status.in_([JobStatus.failed, JobStatus.dead]),
                Job.created_at >= cutoff,
                Job.document_id.is_not(None),
            )
            .group_by(host_expr)
            .order_by(func.count(Job.id).desc())
            .limit(20)
        ).all()
    )
    host_items = [
        AbuseHostItem(host=str(host or "unknown"), failures=int(failures))
        for host, failures in failing_hosts
    ]

    return AbuseOut(
        window_hours=window_hours,
        top_users=user_items,
        top_failing_hosts=host_items,
    )


@router.get("/llm-usage", response_model=LlmUsageOut)
def get_llm_usage(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
    window_days: int = Query(default=7, ge=1, le=90, alias="windowDays"),
) -> LlmUsageOut:
    now = datetime.now(UTC)
    cutoff = now - timedelta(days=window_days)

    day_expr = func.date_trunc("day", ProviderUsage.created_at)

    daily_rows = list(
        db.execute(
            select(
                day_expr.label("day"),
                func.count(ProviderUsage.id).label("requests"),
                func.coalesce(func.sum(ProviderUsage.tokens_in), 0).label("tokens_in"),
                func.coalesce(func.sum(ProviderUsage.tokens_out), 0).label("tokens_out"),
                func.coalesce(func.sum(ProviderUsage.cost_usd_micros), 0).label(
                    "cost_usd_micros"
                ),
            )
            .where(
                ProviderUsage.provider == Provider.openrouter,
                ProviderUsage.action == ProviderAction.summary,
                ProviderUsage.created_at >= cutoff,
            )
            .group_by(day_expr)
            .order_by(day_expr.desc())
            .limit(30)
        ).all()
    )
    daily = [
        LlmDailyItem(
            day=day.astimezone(UTC).date().isoformat() if hasattr(day, "astimezone") else str(day),
            requests=int(requests),
            tokens_in=int(tokens_in),
            tokens_out=int(tokens_out),
            cost_usd_micros=int(cost_usd_micros),
        )
        for day, requests, tokens_in, tokens_out, cost_usd_micros in daily_rows
    ]

    top_user_rows = list(
        db.execute(
            select(
                User.id,
                User.email,
                func.count(ProviderUsage.id).label("requests"),
                func.coalesce(func.sum(ProviderUsage.tokens_in), 0).label("tokens_in"),
                func.coalesce(func.sum(ProviderUsage.tokens_out), 0).label("tokens_out"),
                func.coalesce(func.sum(ProviderUsage.cost_usd_micros), 0).label(
                    "cost_usd_micros"
                ),
            )
            .join(User, User.id == ProviderUsage.user_id)
            .where(
                ProviderUsage.provider == Provider.openrouter,
                ProviderUsage.action == ProviderAction.summary,
                ProviderUsage.created_at >= cutoff,
            )
            .group_by(User.id, User.email)
            .order_by(func.coalesce(func.sum(ProviderUsage.cost_usd_micros), 0).desc())
            .limit(20)
        ).all()
    )
    top_users = [
        LlmTopUserItem(
            user_id=user_id,
            email=email,
            requests=int(requests),
            tokens_in=int(tokens_in),
            tokens_out=int(tokens_out),
            cost_usd_micros=int(cost_usd_micros),
        )
        for user_id, email, requests, tokens_in, tokens_out, cost_usd_micros in top_user_rows
    ]

    return LlmUsageOut(window_days=window_days, daily=daily, top_users=top_users)
