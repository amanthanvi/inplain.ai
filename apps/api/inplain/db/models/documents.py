from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from inplain.db.base import Base
from inplain.db.models.enums import DocumentDocType, DocumentStatus, RobotsStatus, ScheduleTier


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    clerk_user_id: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False
    )

    url: Mapped[str] = mapped_column(Text, nullable=False)
    doc_type: Mapped[DocumentDocType] = mapped_column(
        Enum(DocumentDocType, native_enum=False), nullable=False
    )
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus, native_enum=False),
        nullable=False,
        default=DocumentStatus.active,
        server_default=DocumentStatus.active.value,
    )
    schedule_tier: Mapped[ScheduleTier] = mapped_column(
        Enum(ScheduleTier, native_enum=False),
        nullable=False,
        default=ScheduleTier.daily,
        server_default=ScheduleTier.daily.value,
    )

    next_check_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_snapshot_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    etag: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_modified: Mapped[str | None] = mapped_column(Text, nullable=True)

    robots_checked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    robots_status: Mapped[RobotsStatus] = mapped_column(
        Enum(RobotsStatus, native_enum=False),
        nullable=False,
        default=RobotsStatus.unknown,
        server_default=RobotsStatus.unknown.value,
    )
    robots_rule: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


Index(
    "uq_documents_user_entity_doc_type_active",
    Document.clerk_user_id,
    Document.entity_id,
    Document.doc_type,
    unique=True,
    postgresql_where=Document.deleted_at.is_(None),
)
Index(
    "ix_documents_next_check_at_schedulable",
    Document.next_check_at,
    postgresql_where=Document.status.in_(
        [DocumentStatus.active, DocumentStatus.blocked_robots, DocumentStatus.error]
    )
    & Document.deleted_at.is_(None),
)
Index("ix_documents_clerk_user_id_status", Document.clerk_user_id, Document.status)
