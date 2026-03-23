"""Plans, Entitlements, and Quotas for subscription-based access."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, UUIDMixin, TimestampMixin


class Plan(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "plans"

    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)  # free | pro | enterprise
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    limits: Mapped[dict] = mapped_column(JSONB, default=dict)
    # limits example: {"chat_per_min": 60, "images_per_min": 20, "mcp_tools": false}
    price_monthly_usd: Mapped[int] = mapped_column(Integer, default=0)  # cents
    is_active: Mapped[bool] = mapped_column(default=True)

    entitlements = relationship("Entitlement", back_populates="plan", lazy="noload")

    def __repr__(self) -> str:
        return f"<Plan {self.name}>"


class Entitlement(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "entitlements"

    entity_type: Mapped[str] = mapped_column(String(16), nullable=False)  # user | org
    entity_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    plan_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("plans.id"), nullable=False
    )
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    plan = relationship("Plan", back_populates="entitlements", lazy="joined")
    quotas = relationship("Quota", back_populates="entitlement", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Entitlement {self.entity_type}:{self.entity_id} plan={self.plan_id}>"


class Quota(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "quotas"

    entitlement_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("entitlements.id", ondelete="CASCADE"), nullable=False
    )
    resource_type: Mapped[str] = mapped_column(String(64), nullable=False)  # chat | images | mcp_calls | tokens
    limit_value: Mapped[int] = mapped_column(Integer, nullable=False)
    used_value: Mapped[int] = mapped_column(Integer, default=0)
    period: Mapped[str] = mapped_column(String(16), default="monthly")  # daily | monthly | unlimited

    entitlement = relationship("Entitlement", back_populates="quotas")

    def __repr__(self) -> str:
        return f"<Quota {self.resource_type} {self.used_value}/{self.limit_value}>"
