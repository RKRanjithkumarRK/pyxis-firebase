"""
Celery tasks — analytics batching.

UI events are buffered in Redis and flushed to Postgres in batches
to avoid high-frequency DB writes.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from celery import shared_task

logger = logging.getLogger(__name__)

_REDIS_UI_EVENTS_KEY = "pyxis:ui_events:buffer"


@shared_task(name="worker.tasks.analytics.flush_ui_events")
def flush_ui_events() -> dict:
    """Drain the Redis UI-event buffer and insert rows into Postgres."""
    import asyncio
    return asyncio.run(_flush_async())


async def _flush_async() -> dict:
    try:
        from core.redis import get_redis
        from db.engine import async_session_factory
        from db.models.analytics import UIEvent

        r = await get_redis()
        raw_events = await r.lrange(_REDIS_UI_EVENTS_KEY, 0, -1)
        if not raw_events:
            return {"flushed": 0}

        await r.delete(_REDIS_UI_EVENTS_KEY)

        events = [json.loads(e) for e in raw_events]
        import uuid as _uuid
        rows = [
            UIEvent(
                id=_uuid.uuid4(),
                user_id=e.get("user_id"),
                session_id=e.get("session_id"),
                event_type=e.get("event_type", e.get("event", "unknown")),
                component=e.get("component", e.get("page")),
                properties=e.get("properties", e.get("metadata", {})),
            )
            for e in events
        ]

        async with async_session_factory() as session:
            session.add_all(rows)
            await session.commit()

        logger.info("Flushed %d UI events to Postgres.", len(rows))
        return {"flushed": len(rows)}

    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to flush UI events: %s", exc)
        return {"error": str(exc)}
