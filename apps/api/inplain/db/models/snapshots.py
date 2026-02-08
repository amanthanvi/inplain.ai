from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from inplain.db.base import Base


class Snapshot(Base):
    __tablename__ = "snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False
    )

    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fetch_method: Mapped[str] = mapped_column(Text, nullable=False)
    http_status: Mapped[int] = mapped_column(Integer, nullable=False)
    content_type: Mapped[str | None] = mapped_column(Text, nullable=True)

    extracted_text: Mapped[str] = mapped_column(Text, nullable=False)
    extracted_sha256: Mapped[str] = mapped_column(Text, nullable=False)
    extract_version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    byte_size_extracted: Mapped[int] = mapped_column(Integer, nullable=False)

    retention_delete_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


Index("ix_snapshots_document_id_fetched_at", Snapshot.document_id, Snapshot.fetched_at)
Index("ix_snapshots_retention_delete_at", Snapshot.retention_delete_at)
