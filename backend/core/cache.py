"""
Simple in-process TTL cache for deterministic AI responses and search results.
Drop-in interface ready for Redis backend swap.
"""
import hashlib
import time
from typing import Optional

_cache: dict[str, tuple[str, float]] = {}  # key -> (value, expires_at)

def make_key(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode()).hexdigest()

def get(key: str) -> Optional[str]:
    entry = _cache.get(key)
    if entry and entry[1] > time.monotonic():
        return entry[0]
    if entry:
        del _cache[key]
    return None

def set(key: str, value: str, ttl: int = 3600) -> None:
    _cache[key] = (value, time.monotonic() + ttl)

def invalidate(key: str) -> None:
    _cache.pop(key, None)

def stats() -> dict:
    now = time.monotonic()
    alive = sum(1 for _, exp in _cache.values() if exp > now)
    return {"total": len(_cache), "alive": alive}
