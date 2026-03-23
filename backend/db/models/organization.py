"""Organization, Workspace, and Membership models for multi-tenancy."""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, UUIDMixin, TimestampMixin


class Organization(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id], lazy="joined")
    workspaces = relationship("Workspace", back_populates="organization", lazy="selectin")
    memberships = relationship("Membership", back_populates="organization", lazy="noload")

    def __repr__(self) -> str:
        return f"<Organization {self.slug}>"


class Workspace(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "workspaces"

    org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)

    # Relationships
    organization = relationship("Organization", back_populates="workspaces")

    def __repr__(self) -> str:
        return f"<Workspace {self.slug}>"


class Membership(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "memberships"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True
    )
    role: Mapped[str] = mapped_column(String(32), default="member")  # owner | admin | member | viewer

    # Relationships
    user = relationship("User", back_populates="memberships")
    organization = relationship("Organization", back_populates="memberships")

    def __repr__(self) -> str:
        return f"<Membership user={self.user_id} org={self.org_id} role={self.role}>"
