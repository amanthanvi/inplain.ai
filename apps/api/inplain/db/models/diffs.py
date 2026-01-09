import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Numeric, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from inplain.db.base import Base
from inplain.db.models.enums import DiffFormat


class Diff(Base):
    __tablename__ = "diffs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False
    )

    from_snapshot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("snapshots.id"), nullable=False
    )
    to_snapshot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("snapshots.id"), nullable=False
    )

    diff_format: Mapped[DiffFormat] = mapped_column(
        Enum(DiffFormat, native_enum=False), nullable=False
    )
    unified_diff: Mapped[str] = mapped_column(Text, nullable=False)
    diff_hunks: Mapped[dict] = mapped_column(JSONB, nullable=False)
    change_score: Mapped[float] = mapped_column(Numeric, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (UniqueConstraint("from_snapshot_id", "to_snapshot_id"),)


Index("ix_diffs_document_id_created_at_desc", Diff.document_id, Diff.created_at.desc())
