"""Casbin ABAC policy storage in Postgres."""

from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base, UUIDMixin, TimestampMixin


class CasbinPolicy(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "casbin_policies"

    ptype: Mapped[str] = mapped_column(String(16), nullable=False, index=True)  # p | g | g2
    v0: Mapped[str] = mapped_column(String(256), default="")
    v1: Mapped[str] = mapped_column(String(256), default="")
    v2: Mapped[str] = mapped_column(String(256), default="")
    v3: Mapped[str] = mapped_column(String(256), default="")
    v4: Mapped[str] = mapped_column(String(256), default="")
    v5: Mapped[str] = mapped_column(String(256), default="")

    def __repr__(self) -> str:
        return f"<CasbinPolicy {self.ptype} {self.v0} {self.v1} {self.v2}>"
