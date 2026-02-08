from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from inplain.db.base import Base
from inplain.db.models.enums import SummaryStatus


class ChangeEvent(Base):
    __tablename__ = "change_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False
    )
    diff_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("diffs.id"), nullable=False
    )

    title: Mapped[str] = mapped_column(Text, nullable=False)
    summary_status: Mapped[SummaryStatus] = mapped_column(
        Enum(SummaryStatus, native_enum=False),
        nullable=False,
        default=SummaryStatus.pending,
        server_default=SummaryStatus.pending.value,
    )

    summary_what_changed: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    summary_why_matters: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    summary_model: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_prompt_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    summary_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


Index("ix_change_events_document_id_created_at", ChangeEvent.document_id, ChangeEvent.created_at)
