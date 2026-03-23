"""v1 Analytics router — /api/v1/analytics/* (token usage + UI events)"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from core.abac import AbacContext, get_abac_context
from db.engine import get_db
from db.models.analytics import TokenUsage, UIEvent

router = APIRouter(prefix="/analytics", tags=["v1 Analytics"])


# ── Schemas ───────────────────────────────────────────────────────────
class TokenUsageIn(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    session_id: str | None = None
    model_id: str
    model_profile: str | None = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    feature: str | None = None


class UIEventIn(BaseModel):
    event_type: str
    component: str | None = None
    session_id: str | None = None
    properties: dict[str, Any] = {}


class BatchUIEventsIn(BaseModel):
    events: list[UIEventIn]


# ── Token usage ───────────────────────────────────────────────────────
@router.post("/token-usage", status_code=status.HTTP_204_NO_CONTENT)
async def record_token_usage(
    body: TokenUsageIn,
    ctx: AbacContext = Depends(get_abac_context),
    db: AsyncSession = Depends(get_db),
):
    """Record a single LLM token usage event."""
    from services.user_sync import get_user_by_firebase_uid
    user = await get_user_by_firebase_uid(db, ctx.user_id)
    user_id = user.id if user else None

    total = body.prompt_tokens + body.completion_tokens
    # Rough cost estimate in microcents (varies by model — use input/output pricing)
    cost = _estimate_cost_microcents(body.model_id, body.prompt_tokens, body.completion_tokens)

    usage = TokenUsage(
        id=uuid.uuid4(),
        user_id=user_id,
        session_id=uuid.UUID(body.session_id) if body.session_id else None,
        model_id=body.model_id,
        model_profile=body.model_profile,
        prompt_tokens=body.prompt_tokens,
        completion_tokens=body.completion_tokens,
        total_tokens=total,
        cost_usd_microcents=cost,
        feature=body.feature,
    )
    db.add(usage)
    await db.flush()


def _estimate_cost_microcents(model_id: str, prompt: int, completion: int) -> int:
    """Rough per-token cost in USD microcents (1 USD = 10^8 microcents)."""
    # Claude Opus-class: $15/1M input, $75/1M output
    # Claude Sonnet-class: $3/1M input, $15/1M output
    if "opus" in model_id:
        input_rate, output_rate = 15.0, 75.0
    elif "sonnet" in model_id:
        input_rate, output_rate = 3.0, 15.0
    elif "haiku" in model_id:
        input_rate, output_rate = 0.25, 1.25
    else:
        input_rate, output_rate = 3.0, 15.0

    cost_usd = (prompt * input_rate + completion * output_rate) / 1_000_000
    return int(cost_usd * 100_000_000)  # convert to microcents


# ── UI events ─────────────────────────────────────────────────────────
@router.post("/ui-events", status_code=status.HTTP_204_NO_CONTENT)
async def record_ui_event(
    body: UIEventIn,
    ctx: AbacContext = Depends(get_abac_context),
    db: AsyncSession = Depends(get_db),
):
    """Record a single UI interaction event."""
    from services.user_sync import get_user_by_firebase_uid
    user = await get_user_by_firebase_uid(db, ctx.user_id)

    event = UIEvent(
        id=uuid.uuid4(),
        user_id=user.id if user else None,
        session_id=uuid.UUID(body.session_id) if body.session_id else None,
        event_type=body.event_type,
        component=body.component,
        properties=body.properties,
    )
    db.add(event)
    await db.flush()


@router.post("/ui-events/batch", status_code=status.HTTP_204_NO_CONTENT)
async def record_ui_events_batch(
    body: BatchUIEventsIn,
    ctx: AbacContext = Depends(get_abac_context),
    db: AsyncSession = Depends(get_db),
):
    """Batch-record UI events (called by frontend flush)."""
    from services.user_sync import get_user_by_firebase_uid
    user = await get_user_by_firebase_uid(db, ctx.user_id)
    user_id = user.id if user else None

    for evt in body.events:
        event = UIEvent(
            id=uuid.uuid4(),
            user_id=user_id,
            session_id=uuid.UUID(evt.session_id) if evt.session_id else None,
            event_type=evt.event_type,
            component=evt.component,
            properties=evt.properties,
        )
        db.add(event)

    await db.flush()
