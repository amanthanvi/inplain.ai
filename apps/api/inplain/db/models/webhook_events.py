import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Index, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from inplain.db.base import Base
from inplain.db.models.enums import WebhookSource, WebhookStatus


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    source: Mapped[WebhookSource] = mapped_column(
        Enum(WebhookSource, native_enum=False), nullable=False
    )
    external_id: Mapped[str] = mapped_column(Text, nullable=False)

    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    status: Mapped[WebhookStatus] = mapped_column(
        Enum(WebhookStatus, native_enum=False), nullable=False
    )
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (UniqueConstraint("source", "external_id"),)


Index("ix_webhook_events_status_received_at", WebhookEvent.status, WebhookEvent.received_at)
