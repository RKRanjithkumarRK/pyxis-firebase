"""
Notification engine — dispatches to email, Slack, and in-app channels.

Usage:
    from notifications.engine import notify

    await notify(
        db=db,
        user_id=user.id,
        event_type="task_complete",
        title="Your report is ready",
        body="The weekly analytics report has been generated.",
        action_url="/reports/latest",
        meta={"task_id": str(task_id)},
    )
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def notify(
    db: AsyncSession,
    user_id: uuid.UUID,
    event_type: str,
    title: str,
    body: str,
    action_url: str | None = None,
    meta: dict | None = None,
    channels: list[str] | None = None,
) -> None:
    """
    Create an in-app notification and dispatch to configured channels.

    channels: list of ["email", "slack", "in_app"] — defaults to user prefs.
    """
    from db.models.notification import Notification, NotificationPreference

    # Resolve user preferences
    prefs_result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.event_type.in_([event_type, "*"]),
        )
    )
    prefs = prefs_result.scalars().all()

    send_email = any(p.email_enabled for p in prefs) if prefs else True
    send_slack = any(p.slack_enabled for p in prefs) if prefs else False
    send_in_app = any(p.in_app_enabled for p in prefs) if prefs else True
    slack_webhook = next((p.slack_webhook_url for p in prefs if p.slack_webhook_url), None)

    # Override with explicit channels if provided
    if channels is not None:
        send_email = "email" in channels
        send_slack = "slack" in channels
        send_in_app = "in_app" in channels

    channels_sent: dict[str, str] = {}
    delivery_status: dict[str, str] = {}

    # In-app notification (always created for the notification center)
    notif = Notification(
        id=uuid.uuid4(),
        user_id=user_id,
        event_type=event_type,
        title=title,
        body=body,
        action_url=action_url,
        meta=meta or {},
        channels_sent={},
        delivery_status={},
    )
    db.add(notif)
    await db.flush()

    if send_in_app:
        channels_sent["in_app"] = "sent"
        delivery_status["in_app"] = "sent"

    # Email dispatch (via Celery task to avoid blocking request)
    if send_email:
        try:
            from worker.tasks.notifications import send_email_notification
            send_email_notification.delay(
                user_id=str(user_id),
                notification_id=str(notif.id),
                event_type=event_type,
                title=title,
                body=body,
            )
            channels_sent["email"] = "queued"
            delivery_status["email"] = "queued"
        except Exception as exc:
            logger.warning("Failed to queue email notification: %s", exc)
            delivery_status["email"] = "failed"

    # Slack dispatch (via Celery task)
    if send_slack:
        try:
            from worker.tasks.notifications import send_slack_notification
            send_slack_notification.delay(
                webhook_url=slack_webhook or "",
                title=title,
                body=body,
                event_type=event_type,
                action_url=action_url or "",
            )
            channels_sent["slack"] = "queued"
            delivery_status["slack"] = "queued"
        except Exception as exc:
            logger.warning("Failed to queue Slack notification: %s", exc)
            delivery_status["slack"] = "failed"

    # Update notification with dispatch status
    notif.channels_sent = channels_sent
    notif.delivery_status = delivery_status
    await db.flush()

    logger.debug(
        "Notification created: event=%s user=%s channels=%s",
        event_type, user_id, list(channels_sent.keys()),
    )
