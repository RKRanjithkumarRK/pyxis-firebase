"""v1 Feature Flags router — /api/v1/flags/*"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.abac import AbacContext, get_abac_context
from core.flags import is_enabled, invalidate_flag_cache
from db.engine import get_db

router = APIRouter(prefix="/flags", tags=["v1 Feature Flags"])


class FlagEvalOut(BaseModel):
    key: str
    enabled: bool


@router.get("/eval/{flag_key}", response_model=FlagEvalOut)
async def evaluate_flag(
    flag_key: str,
    ctx: AbacContext = Depends(get_abac_context),
    db: AsyncSession = Depends(get_db),
):
    """Evaluate a single feature flag for the current user."""
    enabled = await is_enabled(flag_key, ctx, db)
    return FlagEvalOut(key=flag_key, enabled=enabled)


@router.post("/eval/batch", response_model=list[FlagEvalOut])
async def evaluate_flags_batch(
    keys: list[str],
    ctx: AbacContext = Depends(get_abac_context),
    db: AsyncSession = Depends(get_db),
):
    """Evaluate multiple feature flags in one request."""
    results = []
    for key in keys:
        enabled = await is_enabled(key, ctx, db)
        results.append(FlagEvalOut(key=key, enabled=enabled))
    return results
