"""
Voice router — short AI responses optimized for text-to-speech output.
Optionally performs web search before answering if query needs live data.
Full 4-level provider fallback: Gemini chain → OpenRouter free models.
"""

import json
import logging
import re
from typing import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from core.auth import verify_token
from core.config import get_settings
from schemas.models import VoiceRequest
from services import gemini, openrouter

logger = logging.getLogger(__name__)
router = APIRouter()

SEARCH_TRIGGERS = re.compile(
    r"\b(weather|news|stock|price|score|latest|today|current|now|"
    r"2024|2025|2026|recent|live|breaking|update)\b",
    re.IGNORECASE,
)

VOICE_SYSTEM_PROMPT = (
    "You are Pyxis Voice, a concise AI assistant optimized for speech. "
    "Give SHORT, natural-sounding answers (2-4 sentences maximum). "
    "No markdown, no bullet points, no code blocks. "
    "Speak like a knowledgeable friend, not a textbook."
)


async def _web_context(query: str) -> str:
    """Fetch brief web context if the query needs real-time data."""
    try:
        from routers.search import _duckduckgo_search, _wikipedia_search
        results = await _duckduckgo_search(query)
        if not results:
            results = await _wikipedia_search(query)
        if results:
            snippets = [f"- {r.title}: {r.snippet}" for r in results[:3]]
            return "\n\nWeb context:\n" + "\n".join(snippets)
    except Exception as e:
        logger.warning(f"Voice web search failed: {e}")
    return ""


async def _voice_stream(
    req: VoiceRequest, gemini_key: str, openrouter_key: str
) -> AsyncGenerator[str, None]:
    system = VOICE_SYSTEM_PROMPT

    # Enrich with live data if needed
    if SEARCH_TRIGGERS.search(req.message):
        context = await _web_context(req.message)
        if context:
            system += context

    def sse(token: str) -> str:
        return f"data: {json.dumps({'content': token})}\n\n"

    # ── Level 1: Gemini (with internal model fallback chain) ──────────
    if gemini_key:
        model = req.model if req.model.startswith("gemini") else "gemini-2.0-flash"
        try:
            tokens_seen = False
            async for token in gemini.stream_chat(
                message=req.message,
                model_id=model,
                history=[],
                system_prompt=system,
                api_key=gemini_key,
                timeout=20.0,
                mode="chat",
            ):
                tokens_seen = True
                yield sse(token)
            if tokens_seen:
                yield "data: [DONE]\n\n"
                return
        except Exception as e:
            logger.warning(f"Voice Gemini failed: {type(e).__name__}: {e}")

    # ── Level 2: OpenRouter free models ───────────────────────────────
    if openrouter_key:
        try:
            tokens_seen = False
            async for token in openrouter.stream_chat_free(
                message=req.message,
                history=[],
                system_prompt=system,
                api_key=openrouter_key,
                mode="chat",
            ):
                tokens_seen = True
                yield sse(token)
            if tokens_seen:
                yield "data: [DONE]\n\n"
                return
        except Exception as e:
            logger.warning(f"Voice OpenRouter fallback failed: {type(e).__name__}: {e}")

    # ── All providers exhausted ────────────────────────────────────────
    yield f"data: {json.dumps({'error': 'All AI providers are currently rate-limited. Please try again in a moment.'})}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/voice")
async def voice_chat(req: VoiceRequest, user: dict = Depends(verify_token)):
    settings = get_settings()
    gemini_key = settings.gemini_api_key
    openrouter_key = settings.openrouter_api_key

    return StreamingResponse(
        _voice_stream(req, gemini_key, openrouter_key),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
