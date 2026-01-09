import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from inplain.db.base import Base
from inplain.db.models.enums import (
    DocumentDocType,
    DocumentStatus,
    FetchMode,
    RobotsStatus,
    ScheduleTier,
)


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False
    )

    url: Mapped[str] = mapped_column(Text, nullable=False)
    url_canonical: Mapped[str] = mapped_column(Text, nullable=False)

    doc_type: Mapped[DocumentDocType] = mapped_column(
        Enum(DocumentDocType, native_enum=False), nullable=False
    )
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus, native_enum=False), nullable=False
    )
    fetch_mode: Mapped[FetchMode] = mapped_column(
        Enum(FetchMode, native_enum=False),
        nullable=False,
        default=FetchMode.auto,
        server_default=FetchMode.auto.value,
    )
    schedule_tier: Mapped[ScheduleTier] = mapped_column(
        Enum(ScheduleTier, native_enum=False), nullable=False
    )

    next_due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_snapshot_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    last_change_event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

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

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


Index("ix_documents_user_id_status", Document.user_id, Document.status)
Index("ix_documents_entity_id", Document.entity_id)
Index(
    "uq_documents_user_id_url_canonical_active",
    Document.user_id,
    Document.url_canonical,
    unique=True,
    postgresql_where=Document.deleted_at.is_(None),
)
Index(
    "ix_documents_next_due_at_active",
    Document.next_due_at,
    postgresql_where=(Document.status == DocumentStatus.active) & Document.deleted_at.is_(None),
)
