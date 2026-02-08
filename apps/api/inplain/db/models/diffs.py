from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Numeric, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from inplain.db.base import Base
from inplain.db.models.enums import DiffClassification


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

    diff_hunks: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list, server_default=func.jsonb_build_array()
    )
    change_score: Mapped[float] = mapped_column(Numeric, nullable=False)
    change_classification: Mapped[DiffClassification] = mapped_column(
        Enum(DiffClassification, native_enum=False), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


Index("uq_diffs_from_to_snapshot", Diff.from_snapshot_id, Diff.to_snapshot_id, unique=True)
Index("ix_diffs_document_id_created_at", Diff.document_id, Diff.created_at)
