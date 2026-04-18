"""
Voice router — short AI responses optimized for text-to-speech output.

Model routing:
  gemini-*              → Gemini (multi-key pool + model fallback chain)
  llama-3.3-70b / llama-3.1-8b (Groq variants) → Groq
  llama3.3-70b / llama3.1-8b (Cerebras)        → Cerebras
  Meta-Llama-* (SambaNova)                      → SambaNova
  gpt-4o*                                       → OpenAI
  anything else                                 → OpenRouter free

Auto-fallback chain if the chosen provider fails:
  Groq → Cerebras → Gemini (pool) → OpenRouter → SambaNova → error
"""

import json
import logging
import re
import time
from typing import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from core.auth import verify_token
from core.config import get_settings
from schemas.models import VoiceRequest
from services import gemini, groq_service, cerebras_service, sambanova_service, openai_service, openrouter

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


def _classify_model(model_id: str) -> str:
    """Return the provider name for a given model ID."""
    m = model_id.lower()
    if m.startswith("gemini"):
        return "gemini"
    if m in ("llama-3.3-70b-versatile", "llama-3.1-8b-instant"):
        return "groq"
    if m in ("llama3.3-70b", "llama3.1-8b"):
        return "cerebras"
    if "meta-llama" in m or "sambanova" in m:
        return "sambanova"
    if m.startswith("gpt-"):
        return "openai"
    return "openrouter"


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


async def _try_gemini(
    message: str, system: str, model_id: str, keys: list[str]
) -> AsyncGenerator[str, None]:
    """Stream from Gemini — uses multi-key pool + model fallback chain."""
    async for token in gemini.stream_chat(
        message=message,
        model_id=model_id if model_id.startswith("gemini") else "gemini-2.0-flash",
        history=[],
        system_prompt=system,
        api_key=keys,
        timeout=20.0,
        mode="chat",
    ):
        yield token


async def _try_groq(
    message: str, system: str, model_id: str, api_key: str
) -> AsyncGenerator[str, None]:
    async for token in groq_service.stream_chat(
        message=message,
        history=[],
        system_prompt=system,
        api_key=api_key,
        mode="chat",
        model=model_id,
    ):
        yield token


async def _try_cerebras(
    message: str, system: str, model_id: str, api_key: str
) -> AsyncGenerator[str, None]:
    async for token in cerebras_service.stream_chat(
        message=message,
        history=[],
        system_prompt=system,
        api_key=api_key,
        mode="chat",
        model=model_id,
    ):
        yield token


async def _try_sambanova(
    message: str, system: str, model_id: str, api_key: str
) -> AsyncGenerator[str, None]:
    async for token in sambanova_service.stream_chat(
        message=message,
        history=[],
        system_prompt=system,
        api_key=api_key,
        mode="chat",
        model=model_id,
    ):
        yield token


async def _try_openai(
    message: str, system: str, model_id: str, api_key: str
) -> AsyncGenerator[str, None]:
    async for token in openai_service.stream_chat(
        message=message,
        history=[],
        system_prompt=system,
        api_key=api_key,
        mode="chat",
        model=model_id,
    ):
        yield token


async def _try_openrouter(
    message: str, system: str, api_key: str
) -> AsyncGenerator[str, None]:
    async for token in openrouter.stream_chat_free(
        message=message,
        history=[],
        system_prompt=system,
        api_key=api_key,
        mode="chat",
    ):
        yield token


async def _voice_stream(req: VoiceRequest, settings, winning_provider: list = None) -> AsyncGenerator[str, None]:
    system = VOICE_SYSTEM_PROMPT

    # Enrich with live data when needed
    if SEARCH_TRIGGERS.search(req.message):
        context = await _web_context(req.message)
        if context:
            system += context

    def sse(token: str) -> str:
        return f"data: {json.dumps({'content': token})}\n\n"

    gemini_keys = settings.gemini_keys_list
    groq_key    = settings.groq_api_key
    cerebras_key = settings.cerebras_api_key
    sambanova_key = settings.sambanova_api_key
    openai_key  = settings.openai_api_key
    openrouter_key = settings.openrouter_api_key

    model_id = getattr(req, "model", "") or "gemini-2.0-flash"
    provider = _classify_model(model_id)

    # ── Ordered provider list: primary first, then fallbacks ─────────
    # We always try the user's selected provider first, then fall through
    all_providers: list[tuple[str, str | list]] = []

    # Primary (user-selected)
    if provider == "gemini" and gemini_keys:
        all_providers.append(("gemini", gemini_keys))
    elif provider == "groq" and groq_key:
        all_providers.append(("groq", groq_key))
    elif provider == "cerebras" and cerebras_key:
        all_providers.append(("cerebras", cerebras_key))
    elif provider == "sambanova" and sambanova_key:
        all_providers.append(("sambanova", sambanova_key))
    elif provider == "openai" and openai_key:
        all_providers.append(("openai", openai_key))
    elif provider == "openrouter" and openrouter_key:
        all_providers.append(("openrouter", openrouter_key))

    # Fallback chain (fastest free providers first)
    if groq_key     and ("groq", groq_key) not in all_providers:
        all_providers.append(("groq", groq_key))
    if cerebras_key and ("cerebras", cerebras_key) not in all_providers:
        all_providers.append(("cerebras", cerebras_key))
    if gemini_keys  and ("gemini", gemini_keys) not in all_providers:
        all_providers.append(("gemini", gemini_keys))
    if openrouter_key and ("openrouter", openrouter_key) not in all_providers:
        all_providers.append(("openrouter", openrouter_key))
    if sambanova_key and ("sambanova", sambanova_key) not in all_providers:
        all_providers.append(("sambanova", sambanova_key))
    if openai_key   and ("openai", openai_key) not in all_providers:
        all_providers.append(("openai", openai_key))

    for p_name, p_key in all_providers:
        try:
            tokens_seen = False

            if p_name == "gemini":
                gen = _try_gemini(req.message, system, model_id, p_key)
            elif p_name == "groq":
                # Map Cerebras/SambaNova model IDs to valid Groq models if needed
                groq_model = model_id if model_id in ("llama-3.3-70b-versatile", "llama-3.1-8b-instant") else "llama-3.3-70b-versatile"
                gen = _try_groq(req.message, system, groq_model, p_key)
            elif p_name == "cerebras":
                cb_model = model_id if model_id in ("llama3.3-70b", "llama3.1-8b") else "llama3.3-70b"
                gen = _try_cerebras(req.message, system, cb_model, p_key)
            elif p_name == "sambanova":
                sn_model = model_id if model_id.startswith("Meta-Llama") else "Meta-Llama-3.3-70B-Instruct"
                gen = _try_sambanova(req.message, system, sn_model, p_key)
            elif p_name == "openai":
                oa_model = model_id if model_id.startswith("gpt-") else "gpt-4o-mini"
                gen = _try_openai(req.message, system, oa_model, p_key)
            else:  # openrouter
                gen = _try_openrouter(req.message, system, p_key)

            async for token in gen:
                tokens_seen = True
                yield sse(token)

            if tokens_seen:
                if winning_provider is not None:
                    winning_provider[0] = p_name
                yield "data: [DONE]\n\n"
                return

        except Exception as e:
            logger.warning(f"Voice [{p_name}] failed: {type(e).__name__}: {e}")
            continue

    # All providers exhausted
    yield f"data: {json.dumps({'error': 'All AI providers are currently unavailable. Please check your API keys or try again later.'})}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/voice")
async def voice_chat(req: VoiceRequest, user: dict = Depends(verify_token)):
    settings = get_settings()
    t_start = time.monotonic()

    async def _tracked_stream():
        winning_provider = ["unknown"]
        async for chunk in _voice_stream(req, settings, winning_provider):
            yield chunk
        latency = int((time.monotonic() - t_start) * 1000)
        try:
            from core.tracking import track
            track(
                firebase_uid=user["uid"],
                feature="voice",
                provider=winning_provider[0],
                model=getattr(req, "model", "") or "gemini-2.0-flash",
                latency_ms=latency,
                success=(winning_provider[0] != "unknown"),
            )
        except Exception:
            pass

    return StreamingResponse(
        _tracked_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
