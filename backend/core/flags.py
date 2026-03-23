"""
Feature flag service — Postgres-backed flags with rule-based targeting.

Usage:
    from core.flags import is_enabled

    if await is_enabled("multimodal_voice", ctx):
        ...  # feature is on for this user

Flags are cached in Redis with a 60-second TTL to avoid DB hammering.
"""
from __future__ import annotations

import hashlib
import json
import logging
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from core.abac import AbacContext

logger = logging.getLogger(__name__)

_FLAG_CACHE_TTL = 60  # seconds


async def _get_all_flags(db: AsyncSession) -> list[dict]:
    """Fetch all enabled flags from DB, with Redis caching."""
    cache_key = "feature_flags:all"

    # Try Redis cache first
    try:
        from core.redis import get_redis
        r = await get_redis()
        cached = await r.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    # Fall back to DB
    try:
        from db.models.feature_flag import FeatureFlag
        result = await db.execute(select(FeatureFlag))
        flags = result.scalars().all()
        data = [
            {
                "key": f.key,
                "is_enabled": f.is_enabled,
                "rollout_pct": f.rollout_pct,
                "rules": f.rules or [],
                "allowlist": f.allowlist or [],
                "denylist": f.denylist or [],
            }
            for f in flags
        ]
        # Cache in Redis
        try:
            from core.redis import get_redis
            r = await get_redis()
            await r.set(cache_key, json.dumps(data), ex=_FLAG_CACHE_TTL)
        except Exception:
            pass
        return data
    except Exception as exc:
        logger.debug("Feature flag DB lookup failed: %s", exc)
        return []


def _evaluate_rules(rules: list[dict], ctx: "AbacContext") -> bool:
    """Evaluate targeting rules against the ABAC context. All rules must match (AND)."""
    attr_map = {
        "role": ctx.role,
        "plan": ctx.plan,
        "org_id": ctx.org_id,
        "user_id": ctx.user_id,
    }

    for rule in rules:
        attribute = rule.get("attribute", "")
        operator = rule.get("operator", "eq")
        value = rule.get("value")
        actual = attr_map.get(attribute, "")

        if operator == "eq" and actual != value:
            return False
        elif operator == "neq" and actual == value:
            return False
        elif operator == "in" and actual not in (value or []):
            return False
        elif operator == "not_in" and actual in (value or []):
            return False

    return True


def _in_rollout(key: str, user_id: str, pct: int) -> bool:
    """Deterministic percentage rollout using consistent hashing."""
    if pct <= 0:
        return False
    if pct >= 100:
        return True
    bucket = int(hashlib.md5(f"{key}:{user_id}".encode()).hexdigest(), 16) % 100
    return bucket < pct


async def is_enabled(flag_key: str, ctx: "AbacContext", db: AsyncSession | None = None) -> bool:
    """
    Evaluate a feature flag for the given ABAC context.

    Resolution order:
    1. Flag not found or globally disabled → False
    2. User in denylist → False
    3. User in allowlist → True
    4. Rules all match → evaluate rollout percentage
    5. No rules → evaluate rollout percentage
    """
    if db is None:
        return False  # can't evaluate without DB; caller should pass db

    flags = await _get_all_flags(db)
    flag = next((f for f in flags if f["key"] == flag_key), None)

    if flag is None or not flag["is_enabled"]:
        return False

    uid = ctx.user_id

    # Denylist check
    if uid in flag["denylist"]:
        return False

    # Allowlist check (bypasses rules + rollout)
    if uid in flag["allowlist"]:
        return True

    # Rule evaluation
    if flag["rules"] and not _evaluate_rules(flag["rules"], ctx):
        return False

    # Rollout percentage
    return _in_rollout(flag_key, uid, flag["rollout_pct"])


async def invalidate_flag_cache() -> None:
    """Clear the Redis flag cache (call after any flag mutation)."""
    try:
        from core.redis import get_redis
        r = await get_redis()
        await r.delete("feature_flags:all")
    except Exception:
        pass
