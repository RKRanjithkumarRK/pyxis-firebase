"""
Analytics router — serves dashboard metrics from request_logs table.

GET /api/analytics/dashboard  — summary stats (auth required)
GET /api/analytics/providers  — per-provider latency from smart router
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import verify_token
from db.engine import get_db
from db.models.request_log import RequestLog

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/analytics/dashboard")
async def dashboard(
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    """Return aggregated metrics for the dashboard."""
    try:
        now = datetime.now(timezone.utc)
        since_7d = now - timedelta(days=7)
        since_30d = now - timedelta(days=30)

        # ── Total requests (all time) ─────────────────────────────────
        total_result = await db.execute(select(func.count()).select_from(RequestLog))
        total_requests = total_result.scalar() or 0

        # ── Success rate (last 30 days) ───────────────────────────────
        recent_result = await db.execute(
            select(func.count(), func.sum(RequestLog.success.cast("int")))
            .where(RequestLog.created_at >= since_30d)
        )
        row = recent_result.one()
        recent_total = row[0] or 0
        recent_success = row[1] or 0
        success_rate = round((recent_success / recent_total * 100), 1) if recent_total > 0 else 0.0

        # ── Average latency (last 30 days, successful only) ───────────
        avg_result = await db.execute(
            select(func.avg(RequestLog.latency_ms))
            .where(and_(
                RequestLog.created_at >= since_30d,
                RequestLog.success == True,  # noqa: E712
            ))
        )
        avg_latency = round(avg_result.scalar() or 0)

        # ── Requests per provider (last 30 days) ─────────────────────
        provider_result = await db.execute(
            select(RequestLog.provider, func.count().label("count"))
            .where(RequestLog.created_at >= since_30d)
            .group_by(RequestLog.provider)
            .order_by(func.count().desc())
        )
        by_provider = [
            {"provider": row.provider, "count": row.count}
            for row in provider_result.all()
        ]

        # ── Requests per feature (last 30 days) ──────────────────────
        feature_result = await db.execute(
            select(RequestLog.feature, func.count().label("count"))
            .where(RequestLog.created_at >= since_30d)
            .group_by(RequestLog.feature)
            .order_by(func.count().desc())
        )
        by_feature = [
            {"feature": row.feature, "count": row.count}
            for row in feature_result.all()
        ]

        # ── Daily request count (last 7 days) ────────────────────────
        daily_result = await db.execute(
            select(
                func.date_trunc("day", RequestLog.created_at).label("day"),
                func.count().label("count"),
            )
            .where(RequestLog.created_at >= since_7d)
            .group_by(func.date_trunc("day", RequestLog.created_at))
            .order_by(func.date_trunc("day", RequestLog.created_at))
        )
        daily = [
            {"day": str(row.day)[:10], "count": row.count}
            for row in daily_result.all()
        ]

        # ── Recent requests (last 20) ─────────────────────────────────
        recent_result = await db.execute(
            select(
                RequestLog.feature,
                RequestLog.provider,
                RequestLog.model,
                RequestLog.latency_ms,
                RequestLog.success,
                RequestLog.created_at,
            )
            .order_by(RequestLog.created_at.desc())
            .limit(20)
        )
        recent = [
            {
                "feature": row.feature,
                "provider": row.provider,
                "model": row.model,
                "latency_ms": row.latency_ms,
                "success": row.success,
                "time": str(row.created_at)[:19],
            }
            for row in recent_result.all()
        ]

        # ── Top model (last 30 days) ──────────────────────────────────
        top_model_result = await db.execute(
            select(RequestLog.model, func.count().label("count"))
            .where(RequestLog.created_at >= since_30d)
            .group_by(RequestLog.model)
            .order_by(func.count().desc())
            .limit(1)
        )
        top_model_row = top_model_result.first()
        top_model = top_model_row.model if top_model_row else "—"

        return {
            "total_requests": total_requests,
            "success_rate": success_rate,
            "avg_latency_ms": avg_latency,
            "top_model": top_model,
            "by_provider": by_provider,
            "by_feature": by_feature,
            "daily_requests": daily,
            "recent_requests": recent,
        }

    except Exception as exc:
        logger.error(f"Analytics dashboard error: {exc}")
        # Return empty state instead of crashing
        return {
            "total_requests": 0,
            "success_rate": 0.0,
            "avg_latency_ms": 0,
            "top_model": "—",
            "by_provider": [],
            "by_feature": [],
            "daily_requests": [],
            "recent_requests": [],
        }


@router.get("/analytics/providers")
async def provider_stats(user: dict = Depends(verify_token)):
    """Return real-time provider latency stats from smart router (Redis)."""
    try:
        from core.smart_router import get_provider_stats
        stats = await get_provider_stats()
        return {"providers": stats}
    except Exception as exc:
        logger.error(f"Provider stats error: {exc}")
        return {"providers": {}}
