"""
Tracking helpers — log every AI request to request_logs table + smart router.
All calls are fire-and-forget (asyncio.create_task) so they never slow down responses.
"""

import asyncio
import logging

logger = logging.getLogger(__name__)


async def _write_request_log(
    firebase_uid: str,
    feature: str,
    provider: str,
    model: str,
    latency_ms: int,
    success: bool,
    tokens_used: int = 0,
) -> None:
    """Write one row to request_logs and update smart router latency."""
    try:
        from db.engine import async_session_factory
        from db.models.request_log import RequestLog

        async with async_session_factory() as session:
            log = RequestLog(
                firebase_uid=firebase_uid,
                feature=feature,
                provider=provider,
                model=model,
                latency_ms=latency_ms,
                success=success,
                tokens_used=tokens_used,
            )
            session.add(log)
            await session.commit()
    except Exception as e:
        logger.debug(f"tracking._write_request_log DB error (non-critical): {e}")

    # Update smart router latency in Redis
    try:
        from core.smart_router import record_latency
        await record_latency(provider, latency_ms, success)
    except Exception as e:
        logger.debug(f"tracking.record_latency error (non-critical): {e}")


def track(
    firebase_uid: str,
    feature: str,
    provider: str,
    model: str,
    latency_ms: int,
    success: bool = True,
    tokens_used: int = 0,
) -> None:
    """
    Schedule a fire-and-forget tracking write.
    Call this from inside async endpoints after getting the response.
    Never awaited — never blocks the response stream.
    """
    try:
        asyncio.create_task(
            _write_request_log(
                firebase_uid=firebase_uid,
                feature=feature,
                provider=provider,
                model=model,
                latency_ms=latency_ms,
                success=success,
                tokens_used=tokens_used,
            )
        )
    except RuntimeError:
        # No running event loop (e.g. tests) — skip silently
        pass
