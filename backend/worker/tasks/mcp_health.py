"""
Celery tasks — MCP server health checks.

Periodically pings all registered MCP servers and updates their
health_status + health_latency_ms in the database.
"""

from __future__ import annotations

import asyncio
import logging
import time

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name="worker.tasks.mcp_health.check_all_servers")
def check_all_servers() -> dict:
    """Health-check every enabled MCP server and persist results."""
    return asyncio.run(_check_all_async())


async def _check_all_async() -> dict:
    try:
        from sqlalchemy import select
        from db.engine import async_session_factory
        from db.models.mcp_server import McpServer

        async with async_session_factory() as session:
            result = await session.execute(select(McpServer).where(McpServer.is_active.is_(True)))
            servers = result.scalars().all()

        updated = 0
        async with async_session_factory() as session:
            for server in servers:
                status, latency_ms = await _ping_server(server)
                server.health_status = status
                session.add(server)
                updated += 1
            await session.commit()

        logger.info("MCP health check: %d servers updated.", updated)
        return {"checked": updated}

    except Exception as exc:  # noqa: BLE001
        logger.exception("MCP health check failed: %s", exc)
        return {"error": str(exc)}


async def _ping_server(server) -> tuple[str, int | None]:
    """Ping a single MCP server. Returns (status, latency_ms)."""
    t0 = time.perf_counter()
    try:
        if server.transport in ("streamable_http", "sse") and server.url:
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(server.url.rstrip("/") + "/health", timeout=5.0)
                resp.raise_for_status()
        elif server.transport == "builtin":
            pass  # builtins are always healthy
        else:
            # stdio — cannot ping a subprocess without spawning it; mark unknown
            return "unknown", None

        latency_ms = int((time.perf_counter() - t0) * 1000)
        return "healthy", latency_ms

    except Exception as exc:  # noqa: BLE001
        logger.debug("MCP server %s unhealthy: %s", server.name, exc)
        return "unhealthy", None
