"""Analytics models — token usage, UI events, and audit log."""
from __future__ import annotations

import uuid

from sqlalchemy import BigInteger, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, TimestampMixin, UUIDMixin


class TokenUsage(Base, UUIDMixin, TimestampMixin):
    """LLM token consumption record — one row per API call."""

    __tablename__ = "token_usage"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("multimodal_sessions.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    model_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    model_profile: Mapped[str | None] = mapped_column(String(64), nullable=True)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    # Cost in USD microcents (integer to avoid float precision issues)
    cost_usd_microcents: Mapped[int] = mapped_column(BigInteger, default=0)
    # Feature that triggered the call: chat | voice | image | agent | mcp
    feature: Mapped[str | None] = mapped_column(String(64), nullable=True)

    session = relationship("MultimodalSession", back_populates="token_usages")

    def __repr__(self) -> str:
        return f"<TokenUsage model={self.model_id} total={self.total_tokens}>"


class UIEvent(Base, UUIDMixin, TimestampMixin):
    """Frontend interaction tracking."""

    __tablename__ = "ui_events"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("multimodal_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )
    # page_view | click | feature_used | error | search | export
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # Component or page identifier
    component: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Free-form properties dict
    properties: Mapped[dict] = mapped_column(JSONB, default=dict)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    def __repr__(self) -> str:
        return f"<UIEvent {self.event_type} component={self.component}>"


class AuditEvent(Base, UUIDMixin, TimestampMixin):
    """Immutable audit log for security-sensitive actions."""

    __tablename__ = "audit_events"

    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # user.invite | org.settings_change | policy.update | flag.toggle | mcp.connect
    action: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    resource_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    before_state: Mapped[dict] = mapped_column(JSONB, default=dict)
    after_state: Mapped[dict] = mapped_column(JSONB, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    outcome: Mapped[str] = mapped_column(String(32), default="success")
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<AuditEvent {self.action} {self.resource_type}:{self.resource_id}>"
