"""
Tool-chat router — in-tool AI assistance with mode-aware temperature.
Used by Code Studio, Research, Images prompt enhance, etc.
"""

import asyncio
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from core.auth import verify_token
from core.config import get_settings
from core.firebase import get_firestore
from schemas.models import ChatRequest
from services import gemini, openrouter
from services.gemini import TEMPERATURE_PROFILES

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory key cache shared with chat.py approach (5-min TTL)
import time as _time
_tool_key_cache: dict[str, tuple[dict, float]] = {}
_TOOL_KEY_TTL = 300

TOOL_SYSTEM_PROMPT = """\
You are Pyxis AI. Be precise, concise, and practical.
Never hallucinate. Format responses with markdown when helpful.\
"""


def _detect_mode(req: ChatRequest) -> str:
    sp = (req.systemPrompt or "").lower()
    if any(k in sp for k in ("code", "engineer", "program")):
        return "code"
    if any(k in sp for k in ("research", "analysis", "facts")):
        return "research"
    if any(k in sp for k in ("creative", "write", "story")):
        return "creative"
    if any(k in sp for k in ("image", "prompt", "visual", "photo")):
        return "creative"
    return "chat"


def _get_user_keys(uid: str) -> dict:
    if uid.startswith("guest_"):
        return {}
    cached = _tool_key_cache.get(uid)
    if cached and _time.monotonic() - cached[1] < _TOOL_KEY_TTL:
        return cached[0]
    try:
        db = get_firestore()
        doc = db.document(f"users/{uid}/private/apikeys").get()
        keys = doc.to_dict() or {} if doc.exists else {}
        _tool_key_cache[uid] = (keys, _time.monotonic())
        return keys
    except Exception:
        return {}


async def _stream(req: ChatRequest, gemini_key: str, openrouter_key: str, mode: str) -> AsyncGenerator[str, None]:
    history = [
        {"role": m.role, "content": m.content[:3000]}
        for m in req.history[-20:]
    ]
    message = req.message[:15_000]
    system_prompt = req.systemPrompt or TOOL_SYSTEM_PROMPT
    temp = TEMPERATURE_PROFILES.get(mode, 0.65)

    # Try Gemini first
    if gemini_key:
        try:
            async for token in gemini.stream_chat(
                message, "gemini-2.5-flash", history, system_prompt, gemini_key,
                temperature=temp, mode=mode,
            ):
                yield f"data: {json.dumps({'content': token})}\n\n"
            yield "data: [DONE]\n\n"
            return
        except Exception as exc:
            logger.warning(f"Tool chat Gemini failed: {exc}")

    # Fallback to OpenRouter free
    if openrouter_key:
        try:
            async for token in openrouter.stream_chat_free(
                message, history, system_prompt, openrouter_key, mode=mode,
            ):
                yield f"data: {json.dumps({'content': token})}\n\n"
            yield "data: [DONE]\n\n"
            return
        except Exception as exc:
            logger.warning(f"Tool chat OpenRouter failed: {exc}")

    yield f"data: {json.dumps({'error': 'AI unavailable. Check API keys in Settings.'})}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/tool-chat")
async def tool_chat(req: ChatRequest, user: dict = Depends(verify_token)):
    settings = get_settings()
    loop = asyncio.get_event_loop()
    user_keys = await loop.run_in_executor(None, _get_user_keys, user["uid"])
    gemini_key     = user_keys.get("gemini")     or settings.gemini_api_key
    openrouter_key = user_keys.get("openrouter") or settings.openrouter_api_key
    mode = _detect_mode(req)

    return StreamingResponse(
        _stream(req, gemini_key, openrouter_key, mode),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )
