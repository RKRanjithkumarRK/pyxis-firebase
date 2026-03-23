"""Feature flags with rule-based evaluation."""

from __future__ import annotations

from sqlalchemy import Boolean, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base, UUIDMixin, TimestampMixin


class FeatureFlag(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "feature_flags"

    key: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    default_value: Mapped[bool] = mapped_column(Boolean, default=False)
    rules: Mapped[list] = mapped_column(JSONB, default=list)
    # rules example: [{"attribute": "plan", "op": "in", "value": ["pro","enterprise"], "result": true}]
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    def __repr__(self) -> str:
        return f"<FeatureFlag {self.key} default={self.default_value}>"
