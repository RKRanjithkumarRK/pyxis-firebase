"""MCP server registry — admin-managed tool server configurations."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base, UUIDMixin, TimestampMixin


class McpServer(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "mcp_servers"

    org_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    transport: Mapped[str] = mapped_column(String(32), nullable=False)  # stdio | streamable_http | sse | builtin
    command: Mapped[str | None] = mapped_column(String(512), nullable=True)  # stdio only
    args: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # stdio only
    url: Mapped[str | None] = mapped_column(String(1024), nullable=True)  # http/sse only
    env: Mapped[dict] = mapped_column(JSONB, default=dict)  # environment variables for stdio
    allowed_workspaces: Mapped[list] = mapped_column(ARRAY(String(64)), default=lambda: ["*"])
    tools: Mapped[list] = mapped_column(JSONB, default=list)  # cached tool declarations
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    health_status: Mapped[str] = mapped_column(String(32), default="unknown")  # healthy | unhealthy | unknown
    health_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    health_latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    def __repr__(self) -> str:
        return f"<McpServer {self.name} transport={self.transport}>"
