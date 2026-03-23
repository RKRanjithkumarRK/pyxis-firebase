"""
Celery application factory — Pyxis One.

Start worker:
    cd backend
    celery -A worker.celery_app worker --loglevel=info --concurrency=4

Start beat scheduler (for periodic tasks):
    celery -A worker.celery_app beat --loglevel=info
"""

from __future__ import annotations

import logging

from celery import Celery
from celery.signals import worker_ready, worker_shutdown

from core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def create_celery_app() -> Celery:
    app = Celery("pyxis")

    app.config_from_object(
        {
            # Broker + backend
            "broker_url": settings.effective_celery_broker,
            "result_backend": settings.effective_celery_backend,
            # Serialization
            "task_serializer": "json",
            "result_serializer": "json",
            "accept_content": ["json"],
            # Reliability
            "task_acks_late": True,
            "task_reject_on_worker_lost": True,
            "task_default_retry_delay": 30,
            "task_max_retries": 3,
            # Result expiry (24 h)
            "result_expires": 86_400,
            # Timezone
            "timezone": "UTC",
            "enable_utc": True,
            # Auto-discover tasks in these packages
            "imports": [
                "worker.tasks.notifications",
                "worker.tasks.analytics",
                "worker.tasks.mcp_health",
            ],
            # Beat schedule (periodic tasks)
            "beat_schedule": {
                "flush-ui-events-every-5m": {
                    "task": "worker.tasks.analytics.flush_ui_events",
                    "schedule": 300,  # seconds
                },
                "mcp-health-check-every-2m": {
                    "task": "worker.tasks.mcp_health.check_all_servers",
                    "schedule": 120,
                },
                "weekly-usage-summary": {
                    "task": "worker.tasks.notifications.send_weekly_summaries",
                    "schedule": 604_800,  # 7 days
                },
            },
        }
    )
    return app


celery_app = create_celery_app()


@worker_ready.connect
def on_worker_ready(**kwargs):
    logger.info("Celery worker ready.")


@worker_shutdown.connect
def on_worker_shutdown(**kwargs):
    logger.info("Celery worker shutdown.")
