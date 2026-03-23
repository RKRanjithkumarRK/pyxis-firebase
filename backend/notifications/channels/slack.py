"""Slack channel — incoming webhook delivery."""
from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


async def deliver_slack(
    webhook_url: str,
    text: str,
    blocks: list | None = None,
) -> dict:
    """Post a message to a Slack incoming webhook."""
    if not webhook_url:
        from core.config import get_settings
        webhook_url = get_settings().slack_webhook_url

    if not webhook_url:
        logger.warning("Slack webhook not configured — skipping")
        return {"status": "skipped", "reason": "no_webhook_url"}

    payload: dict[str, Any] = {"text": text}
    if blocks:
        payload["blocks"] = blocks

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload)
            resp.raise_for_status()
        logger.info("Slack message sent via webhook")
        return {"status": "sent"}
    except Exception as exc:
        logger.error("Slack delivery failed: %s", exc)
        raise
