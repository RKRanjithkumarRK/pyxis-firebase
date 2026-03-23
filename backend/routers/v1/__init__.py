"""
Pyxis One — API v1 router aggregator.

All enterprise endpoints live under /api/v1/*.
"""

from fastapi import APIRouter

from routers.v1 import analytics, flags, mcp, notifications, orgs, sessions, users

router = APIRouter()

router.include_router(users.router)
router.include_router(orgs.router)
router.include_router(sessions.router)
router.include_router(flags.router)
router.include_router(analytics.router)
router.include_router(mcp.router)
router.include_router(notifications.router)


@router.get("/ping", tags=["v1"])
async def v1_ping():
    return {"version": "v1", "status": "ok"}
