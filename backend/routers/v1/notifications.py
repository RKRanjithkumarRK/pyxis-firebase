"""v1 Notifications router — /api/v1/notifications/*"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.abac import AbacContext, get_abac_context
from db.engine import get_db
from db.models.notification import Notification

router = APIRouter(prefix="/notifications", tags=["v1 Notifications"])


class NotificationOut(BaseModel):
    id: str
    event_type: str
    title: str
    body: str
    is_read: bool
    action_url: str | None
    created_at: str


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    ctx: AbacContext = Depends(get_abac_context),
    db: AsyncSession = Depends(get_db),
    unread_only: bool = False,
):
    """List notifications for the current user (newest first)."""
    from services.user_sync import get_user_by_firebase_uid
    user = await get_user_by_firebase_uid(db, ctx.user_id)
    if not user:
        return []

    query = (
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    if unread_only:
        query = query.where(Notification.is_read == False)

    result = await db.execute(query)
    notifs = result.scalars().all()
    return [
        NotificationOut(
            id=str(n.id), event_type=n.event_type, title=n.title,
            body=n.body, is_read=n.is_read, action_url=n.action_url,
            created_at=n.created_at.isoformat(),
        )
        for n in notifs
    ]


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    notification_id: str,
    ctx: AbacContext = Depends(get_abac_context),
    db: AsyncSession = Depends(get_db),
):
    """Mark a notification as read."""
    result = await db.execute(
        select(Notification).where(Notification.id == uuid.UUID(notification_id))
    )
    notif = result.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.flush()


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(
    ctx: AbacContext = Depends(get_abac_context),
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read for the current user."""
    from services.user_sync import get_user_by_firebase_uid
    user = await get_user_by_firebase_uid(db, ctx.user_id)
    if user:
        await db.execute(
            update(Notification)
            .where(Notification.user_id == user.id, Notification.is_read == False)
            .values(is_read=True)
        )
