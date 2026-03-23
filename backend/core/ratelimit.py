"""
In-process sliding-window rate limiter.
Reads plan from Firestore meta doc (cached 5 min per user).
Swap _store for Redis in multi-worker deployments.
"""
import asyncio
import time
from collections import deque, defaultdict
from fastapi import Depends, HTTPException
from .auth import verify_token

# Enterprise-grade limits — generous for usability, hard cap for abuse prevention
PLANS: dict[str, dict] = {
    "guest":      {"chat": 60,   "images": 20,   "search": 40,  "window": 60},
    "free":       {"chat": 200,  "images": 60,   "search": 100, "window": 60},
    "pro":        {"chat": 600,  "images": 200,  "search": 300, "window": 60},
    "enterprise": {"chat": 2400, "images": 800,  "search": 1200, "window": 60},
}

_store: dict[str, deque] = defaultdict(deque)
_plan_cache: dict[str, tuple[str, float]] = {}  # uid -> (plan, expires_at)
_PLAN_CACHE_TTL = 300.0  # 5 minutes


async def _get_plan(uid: str) -> str:
    """Get user plan with 5-minute in-memory cache to avoid Firestore reads every request."""
    now = time.monotonic()
    cached = _plan_cache.get(uid)
    if cached and cached[1] > now:
        return cached[0]

    # Fetch from Firestore in background thread
    try:
        loop = asyncio.get_event_loop()
        def _fetch():
            from .firebase import get_firestore
            doc = get_firestore().document(f"users/{uid}/private/meta").get()
            return doc.to_dict().get("plan", "free") if doc.exists else "free"
        plan = await loop.run_in_executor(None, _fetch)
    except Exception:
        plan = "free"

    _plan_cache[uid] = (plan, now + _PLAN_CACHE_TTL)
    return plan


def check_rate_limit(resource: str):
    """FastAPI dependency factory — enforces sliding-window rate limit per user/plan."""
    async def _dep(user: dict = Depends(verify_token)) -> dict:
        plan   = await _get_plan(user["uid"])
        cfg    = PLANS.get(plan, PLANS["free"])
        limit  = cfg.get(resource, 60)
        window = cfg["window"]
        key    = f"{user['uid']}:{resource}"
        now    = time.monotonic()
        dq     = _store[key]
        # Evict expired entries
        while dq and dq[0] < now - window:
            dq.popleft()
        if len(dq) >= limit:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit: {limit} {resource} requests/{window}s on {plan} plan. Upgrade for higher limits.",
                headers={"Retry-After": str(window)},
            )
        dq.append(now)
        user["_plan"] = plan
        return user
    return _dep
