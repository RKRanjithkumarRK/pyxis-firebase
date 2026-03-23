"""
Celery tasks — notification delivery.

These tasks are enqueued by the notification engine and run asynchronously
by Celery workers. Each task has auto-retry with exponential back-off.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from celery import shared_task

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine from a sync Celery task."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


@shared_task(
    bind=True,
    name="worker.tasks.notifications.send_email",
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def send_email(self, *, to: str, subject: str, html_body: str, text_body: str = "") -> dict[str, Any]:
    """Send a transactional email via SendGrid."""
    from notifications.channels.email import deliver_email
    return _run_async(deliver_email(to=to, subject=subject, html_body=html_body, text_body=text_body))


@shared_task(
    bind=True,
    name="worker.tasks.notifications.send_slack",
    max_retries=3,
    default_retry_delay=15,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def send_slack(self, *, webhook_url: str, text: str, blocks: list | None = None) -> dict[str, Any]:
    """Send a Slack message via incoming webhook."""
    from notifications.channels.slack import deliver_slack
    return _run_async(deliver_slack(webhook_url=webhook_url, text=text, blocks=blocks))


@shared_task(
    bind=True,
    name="worker.tasks.notifications.send_weekly_summaries",
)
def send_weekly_summaries(self) -> dict[str, Any]:
    """Periodic task: generate and send weekly usage summaries to all users."""
    logger.info("Running weekly summary task…")
    # TODO: query users with weekly_summary preference enabled, generate and send
    return {"status": "queued"}


@shared_task(
    bind=True,
    name="worker.tasks.notifications.send_email_notification",
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def send_email_notification(
    self,
    *,
    user_id: str,
    notification_id: str,
    event_type: str,
    title: str,
    body: str,
) -> dict:
    """Send notification email for a specific notification record."""
    import asyncio
    return asyncio.run(_send_notification_email_async(
        user_id=user_id,
        notification_id=notification_id,
        event_type=event_type,
        title=title,
        body=body,
    ))


async def _send_notification_email_async(
    user_id: str,
    notification_id: str,
    event_type: str,
    title: str,
    body: str,
) -> dict:
    from db.engine import async_session_factory
    from db.models.user import User
    from sqlalchemy import select

    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            return {"status": "skipped", "reason": "user_not_found"}

        from notifications.channels.email import deliver_email
        return await deliver_email(
            to=user.email,
            subject=title,
            html_body=f"<h2>{title}</h2><p>{body}</p>",
            text_body=f"{title}\n\n{body}",
        )


@shared_task(
    bind=True,
    name="worker.tasks.notifications.send_slack_notification",
    max_retries=3,
    default_retry_delay=15,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def send_slack_notification(
    self,
    *,
    webhook_url: str,
    title: str,
    body: str,
    event_type: str,
    action_url: str = "",
) -> dict:
    """Send a Slack notification."""
    import asyncio
    from notifications.channels.slack import deliver_slack
    text = f"*{title}*\n{body}"
    if action_url:
        text += f"\n<{action_url}|View>"
    return asyncio.run(deliver_slack(webhook_url=webhook_url, text=text))
