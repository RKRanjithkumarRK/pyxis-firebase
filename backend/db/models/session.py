"""Multimodal Session models — chat, voice, image sessions with events and assets."""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, TimestampMixin, UUIDMixin


class MultimodalSession(Base, UUIDMixin, TimestampMixin):
    """Unified session spanning chat, voice, and image modalities."""

    __tablename__ = "multimodal_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(512), default="New Session")
    # chat | voice | image | agentic | mixed
    modality: Mapped[str] = mapped_column(String(32), default="chat", index=True)
    # active | archived | deleted
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)
    # routing profile: reasoning | daily | realtime | vision | image
    model_profile: Mapped[str] = mapped_column(String(64), default="daily")
    persona_slug: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # arbitrary session-level metadata (system prompt overrides, temperature, etc.)
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)

    user = relationship("User", back_populates="sessions")
    events: Mapped[list[SessionEvent]] = relationship(
        "SessionEvent", back_populates="session", lazy="noload",
        cascade="all, delete-orphan", order_by="SessionEvent.sequence",
    )
    assets: Mapped[list[GeneratedAsset]] = relationship(
        "GeneratedAsset", back_populates="session", lazy="noload",
        cascade="all, delete-orphan",
    )
    token_usages = relationship("TokenUsage", back_populates="session", lazy="noload")

    def __repr__(self) -> str:
        return f"<MultimodalSession {self.id} modality={self.modality}>"


class SessionEvent(Base, UUIDMixin, TimestampMixin):
    """Individual turn/event within a session."""

    __tablename__ = "session_events"

    session_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("multimodal_sessions.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # user | assistant | tool | system | error
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    # text | image_url | audio_url | tool_call | tool_result | artifact
    content_type: Mapped[str] = mapped_column(String(64), default="text")
    content: Mapped[str] = mapped_column(Text, default="")
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    model_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    sequence: Mapped[int] = mapped_column(Integer, default=0)

    session: Mapped[MultimodalSession] = relationship("MultimodalSession", back_populates="events")

    def __repr__(self) -> str:
        return f"<SessionEvent {self.role} seq={self.sequence}>"


class GeneratedAsset(Base, UUIDMixin, TimestampMixin):
    """AI-generated artifact: image, code, audio, chart, HTML."""

    __tablename__ = "generated_assets"

    session_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("multimodal_sessions.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    event_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("session_events.id", ondelete="SET NULL"), nullable=True,
    )
    # image | code | audio | chart | html | document
    asset_type: Mapped[str] = mapped_column(String(64), nullable=False)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    # renamed from 'metadata' (reserved by SQLAlchemy DeclarativeBase)
    asset_meta: Mapped[dict] = mapped_column(JSONB, default=dict)

    session: Mapped[MultimodalSession] = relationship("MultimodalSession", back_populates="assets")

    def __repr__(self) -> str:
        return f"<GeneratedAsset {self.asset_type} session={self.session_id}>"
