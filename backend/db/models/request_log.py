"""RequestLog — one row per AI API call across chat / voice / image."""
from __future__ import annotations

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base, TimestampMixin, UUIDMixin


class RequestLog(Base, UUIDMixin, TimestampMixin):
    """Tracks every AI request: who, which feature, which provider, how fast, did it succeed."""

    __tablename__ = "request_logs"

    # Firebase UID (string, not FK — keeps this table self-contained even if users table lags)
    firebase_uid: Mapped[str] = mapped_column(String(128), nullable=False, index=True)

    # chat | voice | image
    feature: Mapped[str] = mapped_column(String(32), nullable=False, index=True)

    # gemini | groq | cerebras | sambanova | openai | openrouter | huggingface | pollinations
    provider: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # The model ID requested (e.g. "gemini-2.0-flash", "llama-3.3-70b-versatile")
    model: Mapped[str] = mapped_column(String(128), nullable=False, default="")

    # Time from request start to first token / image URL returned (milliseconds)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # True = got a real response; False = provider error / fallback triggered
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Optional: number of tokens used (0 if not tracked)
    tokens_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:
        return (
            f"<RequestLog feature={self.feature} provider={self.provider} "
            f"latency={self.latency_ms}ms success={self.success}>"
        )
