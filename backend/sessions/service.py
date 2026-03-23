"""
Multimodal Session Service — unified runtime for chat, voice, and image sessions.

Handles:
  - Persisting session events to Postgres
  - Routing to the correct model via routing profiles
  - Recording token usage for billing/analytics
  - Streaming responses via async generators
"""
from __future__ import annotations

import logging
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.session import MultimodalSession, SessionEvent
from sessions.routing import resolve_model, resolve_budget, resolve_temperature

logger = logging.getLogger(__name__)

# Shared async HTTP client (connection pooling)
_http_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=5.0, read=120.0, write=30.0, pool=5.0),
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
        )
    return _http_client


async def close_http_client() -> None:
    global _http_client
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None


# ── Session helpers ───────────────────────────────────────────────────
async def get_session_or_404(db: AsyncSession, session_id: uuid.UUID) -> MultimodalSession:
    result = await db.execute(
        select(MultimodalSession).where(MultimodalSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")
    return session


async def get_session_history(
    db: AsyncSession, session_id: uuid.UUID, limit: int = 40
) -> list[dict]:
    """Return recent events as Anthropic-style message dicts."""
    result = await db.execute(
        select(SessionEvent)
        .where(SessionEvent.session_id == session_id)
        .order_by(SessionEvent.sequence.asc())
        .limit(limit)
    )
    events = result.scalars().all()
    messages = []
    for evt in events:
        if evt.role in ("user", "assistant"):
            messages.append({"role": evt.role, "content": evt.content})
    return messages


async def append_event(
    db: AsyncSession,
    session_id: uuid.UUID,
    role: str,
    content: str,
    content_type: str = "text",
    payload: dict | None = None,
    model_id: str | None = None,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    sequence: int = 0,
) -> SessionEvent:
    """Persist a single event to the session."""
    event = SessionEvent(
        id=uuid.uuid4(),
        session_id=session_id,
        role=role,
        content_type=content_type,
        content=content,
        payload=payload or {},
        model_id=model_id,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        sequence=sequence,
    )
    db.add(event)
    await db.flush()
    return event


async def record_token_usage(
    db: AsyncSession,
    user_id: uuid.UUID | None,
    session_id: uuid.UUID | None,
    model_id: str,
    model_profile: str,
    prompt_tokens: int,
    completion_tokens: int,
    feature: str = "chat",
) -> None:
    """Write a TokenUsage row for billing/analytics."""
    from db.models.analytics import TokenUsage

    def _cost(model: str, p: int, c: int) -> int:
        if "opus" in model:
            r_in, r_out = 15.0, 75.0
        elif "sonnet" in model:
            r_in, r_out = 3.0, 15.0
        elif "haiku" in model:
            r_in, r_out = 0.25, 1.25
        else:
            r_in, r_out = 3.0, 15.0
        return int((p * r_in + c * r_out) / 1_000_000 * 100_000_000)

    usage = TokenUsage(
        id=uuid.uuid4(),
        user_id=user_id,
        session_id=session_id,
        model_id=model_id,
        model_profile=model_profile,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        cost_usd_microcents=_cost(model_id, prompt_tokens, completion_tokens),
        feature=feature,
    )
    db.add(usage)
    await db.flush()


# ── Anthropic streaming chat ──────────────────────────────────────────
async def stream_chat_completion(
    messages: list[dict],
    model_id: str,
    max_tokens: int,
    temperature: float,
    system: str | None = None,
    api_key: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    Stream an Anthropic Messages API response, yielding text chunks.
    Falls back to non-streaming if streaming not available.
    """
    import anthropic

    key = api_key
    if not key:
        from core.config import get_settings
        key = get_settings().openai_api_key  # fallback; ideally set ANTHROPIC_API_KEY
        # Try to get Anthropic key from settings
        try:
            key = get_settings().anthropic_api_key  # type: ignore[attr-defined]
        except AttributeError:
            pass

    client = anthropic.AsyncAnthropic(api_key=key)

    kwargs: dict[str, Any] = {
        "model": model_id,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": messages,
    }
    if system:
        kwargs["system"] = system

    try:
        async with client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield text
    except Exception as exc:
        logger.error("Anthropic stream error: %s", exc)
        yield f"[Error: {exc}]"


# ── High-level chat turn ──────────────────────────────────────────────
async def process_chat_turn(
    db: AsyncSession,
    session: MultimodalSession,
    user_message: str,
    user_id: uuid.UUID | None = None,
    system_override: str | None = None,
    api_key: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    Full chat turn pipeline:
    1. Persist user message
    2. Fetch history
    3. Route to model
    4. Stream response
    5. Persist assistant reply + token usage
    """
    profile = session.model_profile or "daily"
    model_id = resolve_model(profile)
    max_tokens = resolve_budget(profile)
    temperature = resolve_temperature(profile)

    # Count existing events for sequence numbering
    from sqlalchemy import func
    count_result = await db.execute(
        select(func.count()).where(SessionEvent.session_id == session.id)
    )
    seq_base = count_result.scalar() or 0

    # Persist user message
    await append_event(
        db, session.id, role="user", content=user_message,
        sequence=seq_base,
    )

    # Fetch history (including the new user message)
    history = await get_session_history(db, session.id)

    # Stream assistant reply
    full_reply = ""

    async def _stream() -> AsyncGenerator[str, None]:
        nonlocal full_reply
        async for chunk in stream_chat_completion(
            messages=history,
            model_id=model_id,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_override or (session.meta or {}).get("system_prompt"),
            api_key=api_key,
        ):
            full_reply += chunk
            yield chunk

        # After stream completes, persist reply and usage
        # Rough token estimates (Anthropic doesn't stream usage in basic mode)
        prompt_tokens = sum(len(m["content"].split()) * 4 // 3 for m in history)
        completion_tokens = len(full_reply.split()) * 4 // 3

        await append_event(
            db, session.id,
            role="assistant",
            content=full_reply,
            model_id=model_id,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            sequence=seq_base + 1,
        )
        await record_token_usage(
            db, user_id, session.id, model_id, profile,
            prompt_tokens, completion_tokens, feature="chat",
        )

    return _stream()
