from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from inplain.db.models.enums import (
    DocumentDocType,
    DocumentStatus,
    JobQueue,
    JobStatus,
    NotificationType,
    RobotsStatus,
    ScheduleTier,
    SummaryStatus,
)


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class EntityOut(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    website_url: str
    category: str
    policy_urls: dict[str, Any]


class DocumentOut(BaseModel):
    id: uuid.UUID
    clerk_user_id: str
    entity_id: uuid.UUID
    url: str
    doc_type: DocumentDocType
    status: DocumentStatus
    schedule_tier: ScheduleTier
    next_check_at: datetime
    last_checked_at: datetime | None
    last_snapshot_id: uuid.UUID | None
    etag: str | None
    last_modified: str | None
    robots_checked_at: datetime | None
    robots_status: RobotsStatus
    created_at: datetime
    deleted_at: datetime | None


class WatchRequest(BaseModel):
    entity_slug: str = Field(min_length=1)


class WatchResponse(BaseModel):
    entity: EntityOut
    documents: list[DocumentOut]


class EnqueueResponse(BaseModel):
    job_id: uuid.UUID
    queued: bool


class JobOut(BaseModel):
    id: uuid.UUID
    queue: JobQueue
    clerk_user_id: str | None
    document_id: uuid.UUID | None
    status: JobStatus
    payload: dict[str, Any]
    attempt: int
    max_attempts: int
    error: str | None
    run_at: datetime
    locked_at: datetime | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime


class NotificationOut(BaseModel):
    id: uuid.UUID
    clerk_user_id: str
    type: NotificationType
    title: str
    body: str
    payload: dict[str, Any]
    read_at: datetime | None
    created_at: datetime


class UnreadCountOut(BaseModel):
    unread: int


class MarkReadRequest(BaseModel):
    notification_ids: list[uuid.UUID]


class ChangeEventOut(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    diff_id: uuid.UUID
    title: str
    summary_status: SummaryStatus
    summary_what_changed: list[dict[str, Any]] | None
    summary_why_matters: list[dict[str, Any]] | None
    summary_model: str | None
    summary_prompt_version: int | None
    summary_error: str | None
    created_at: datetime


class DiffOut(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    from_snapshot_id: uuid.UUID
    to_snapshot_id: uuid.UUID
    diff_hunks: list[dict[str, Any]]
    change_score: float
    change_classification: str
    created_at: datetime


class ChangeEventDetailOut(BaseModel):
    change_event: ChangeEventOut
    diff: DiffOut

