import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Index, Integer, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from inplain.db.base import Base
from inplain.db.models.enums import Provider, ProviderAction


class ProviderUsage(Base):
    __tablename__ = "provider_usage"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True
    )

    provider: Mapped[Provider] = mapped_column(Enum(Provider, native_enum=False), nullable=False)
    action: Mapped[ProviderAction] = mapped_column(
        Enum(ProviderAction, native_enum=False), nullable=False
    )

    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    tokens_in: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_out: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cost_usd_micros: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    period_key: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


Index(
    "ix_provider_usage_user_period_provider_action",
    ProviderUsage.user_id,
    ProviderUsage.period_key,
    ProviderUsage.provider,
    ProviderUsage.action,
)
Index("ix_provider_usage_created_at", ProviderUsage.created_at)
