from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from inplain.db.base import Base
from inplain.db.models.enums import JobQueue, JobStatus


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    queue: Mapped[JobQueue] = mapped_column(Enum(JobQueue, native_enum=False), nullable=False)
    clerk_user_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True
    )

    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, native_enum=False),
        nullable=False,
        default=JobStatus.queued,
        server_default=JobStatus.queued.value,
    )
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=func.jsonb_build_object()
    )
    attempt: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    max_attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, default=5, server_default="5"
    )

    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    run_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


Index(
    "ix_jobs_queue_status_run_at",
    Job.queue,
    Job.status,
    Job.run_at,
    postgresql_where=Job.status == JobStatus.queued,
)
Index("ix_jobs_document_id_created_at", Job.document_id, Job.created_at)
Index("ix_jobs_status_created_at", Job.status, Job.created_at)
