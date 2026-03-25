"""
Smart provider router — picks the fastest AI provider based on rolling latency.

How it works:
  - After every successful request, we record latency_ms in Redis.
  - We keep a rolling window of the last 20 latency values per provider.
  - When no specific model is requested, we pick the provider with the lowest
    rolling average latency.
  - Falls back to the default priority order if Redis is unavailable.

Redis keys:
  smart_router:latency:{provider}  → Redis LIST of recent latency integers (max 20)
  smart_router:errors:{provider}   → Redis counter of errors in last 5 minutes
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Default priority order (used when no latency data exists yet)
DEFAULT_ORDER = ["groq", "cerebras", "gemini", "sambanova", "openrouter", "openai"]

# Window size for rolling average
_WINDOW = 20
# Error penalty: providers with recent errors get this fake latency added
_ERROR_PENALTY_MS = 5000


async def record_latency(provider: str, latency_ms: int, success: bool) -> None:
    """Called after every AI request to update the rolling latency window."""
    try:
        from core.redis import get_redis
        r = await get_redis()

        key = f"smart_router:latency:{provider}"
        pipe = r.pipeline()
        pipe.rpush(key, latency_ms)
        pipe.ltrim(key, -_WINDOW, -1)   # keep only last N values
        pipe.expire(key, 3600)           # expire after 1 hour of inactivity

        if not success:
            err_key = f"smart_router:errors:{provider}"
            pipe.incr(err_key)
            pipe.expire(err_key, 300)    # reset error count every 5 minutes

        await pipe.execute()
    except Exception as e:
        logger.debug(f"smart_router.record_latency failed (non-critical): {e}")


async def get_provider_stats() -> dict[str, dict]:
    """Return avg latency and error count for all providers."""
    stats: dict[str, dict] = {}
    try:
        from core.redis import get_redis
        r = await get_redis()

        for provider in DEFAULT_ORDER:
            latency_key = f"smart_router:latency:{provider}"
            error_key = f"smart_router:errors:{provider}"

            values = await r.lrange(latency_key, 0, -1)
            errors = await r.get(error_key)

            if values:
                latencies = [int(v) for v in values]
                avg = sum(latencies) / len(latencies)
                error_count = int(errors or 0)
                # Add penalty for recent errors
                effective_avg = avg + (error_count * _ERROR_PENALTY_MS)
                stats[provider] = {
                    "avg_latency_ms": round(avg),
                    "effective_latency_ms": round(effective_avg),
                    "sample_count": len(latencies),
                    "error_count": error_count,
                }
            else:
                stats[provider] = {
                    "avg_latency_ms": None,
                    "effective_latency_ms": None,
                    "sample_count": 0,
                    "error_count": int(errors or 0),
                }
    except Exception as e:
        logger.debug(f"smart_router.get_provider_stats failed: {e}")

    return stats


async def rank_providers(available: list[str]) -> list[str]:
    """
    Return `available` providers sorted by effective latency (fastest first).
    Providers with no data yet keep their original order (DEFAULT_ORDER priority).
    """
    try:
        stats = await get_provider_stats()

        def sort_key(p: str) -> float:
            s = stats.get(p, {})
            eff = s.get("effective_latency_ms")
            if eff is not None:
                return float(eff)
            # No data yet — use position in DEFAULT_ORDER as tiebreaker
            try:
                return 10000.0 + DEFAULT_ORDER.index(p)
            except ValueError:
                return 99999.0

        return sorted(available, key=sort_key)
    except Exception:
        return available  # fail safe: return as-is
