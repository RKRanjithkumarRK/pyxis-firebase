"""Internal user record — keyed by Firebase UID."""

from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, UUIDMixin, TimestampMixin


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    firebase_uid: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), default="")
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(String(32), default="user")  # admin | user | guest

    # Relationships
    memberships = relationship("Membership", back_populates="user", lazy="selectin")
    sessions = relationship("MultimodalSession", back_populates="user", lazy="noload")
    notifications = relationship("Notification", back_populates="user", lazy="noload")

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.firebase_uid})>"
