"""Background task runs with state machine."""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base, UUIDMixin, TimestampMixin


class TaskRun(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "task_runs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True
    )
    task_type: Mapped[str] = mapped_column(String(64), nullable=False)  # scheduled_prompt | mcp_call | workflow | analytics_batch
    state: Mapped[str] = mapped_column(
        String(32), default="queued", nullable=False, index=True
    )  # queued | in_progress | completed | failed | reminder_due
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, default=3)

    def __repr__(self) -> str:
        return f"<TaskRun {self.task_type} state={self.state}>"
