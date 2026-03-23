"""
Shared async Redis client (redis-py 5 with hiredis).

Usage
-----
    from core.redis import get_redis

    r = await get_redis()
    await r.set("key", "value", ex=300)
    val = await r.get("key")
"""

from __future__ import annotations

import logging
from typing import Optional

import redis.asyncio as aioredis

from core.config import get_settings

logger = logging.getLogger(__name__)

_redis_client: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    """Return (and lazily create) the global Redis client."""
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        _redis_client = aioredis.from_url(
            settings.redis_url,
            max_connections=settings.redis_max_connections,
            decode_responses=True,
        )
        logger.debug("Redis client created: %s", settings.redis_url)
    return _redis_client


async def close_redis() -> None:
    """Close the Redis connection pool (called on app shutdown)."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
        logger.debug("Redis client closed.")
