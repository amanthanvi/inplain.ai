import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, LargeBinary, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from inplain.db.base import Base
from inplain.db.models.enums import SnapshotFetchMethod


class Snapshot(Base):
    __tablename__ = "snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False
    )

    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fetch_method: Mapped[SnapshotFetchMethod] = mapped_column(
        Enum(SnapshotFetchMethod, native_enum=False), nullable=False
    )

    http_status: Mapped[int] = mapped_column(Integer, nullable=False)
    final_url: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str | None] = mapped_column(Text, nullable=True)

    raw_storage_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_sha256: Mapped[bytes] = mapped_column(LargeBinary(32), nullable=False)

    extracted_text: Mapped[str] = mapped_column(Text, nullable=False)
    extracted_sha256: Mapped[bytes] = mapped_column(LargeBinary(32), nullable=False)
    extract_version: Mapped[int] = mapped_column(Integer, nullable=False)

    language: Mapped[str | None] = mapped_column(Text, nullable=True)

    byte_size_raw: Mapped[int | None] = mapped_column(Integer, nullable=True)
    byte_size_extracted: Mapped[int] = mapped_column(Integer, nullable=False)

    retention_delete_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


Index("ix_snapshots_document_id_fetched_at_desc", Snapshot.document_id, Snapshot.fetched_at.desc())
Index("ix_snapshots_extracted_sha256", Snapshot.extracted_sha256)
Index("ix_snapshots_retention_delete_at", Snapshot.retention_delete_at)
