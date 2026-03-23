"""
Chat router — enterprise-grade streaming AI with 8-level provider chain:
  Level 1: Gemini      — primary, with multi-key rotation + model fallback
  Level 2: Groq        — blazing fast (LPU hardware), 14,400 RPD free
  Level 3: Cerebras    — ultra-fast (2000+ tok/s), generous free tier
  Level 4: SambaNova   — fast free (wafer-scale), no rate limit issues
  Level 5: OpenAI      — gpt-4o-mini → gpt-4o direct API (reliable paid)
  Level 6: OpenRouter premium — Claude / GPT-4 / Mistral-Large (paid)
  Level 7: OpenRouter free   — last resort, slow but always available

Rate limiting, per-mode temperature, and non-blocking usage telemetry.
"""

import asyncio
import json
import logging
import time
from typing import AsyncGenerator

# In-memory cache: uid → (keys_dict, timestamp)
_key_cache: dict[str, tuple[dict, float]] = {}
_KEY_CACHE_TTL = 300  # 5 minutes

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from google.cloud.firestore_v1.transforms import SERVER_TIMESTAMP

from core.config import get_settings
from core.firebase import get_firestore
from core.ratelimit import check_rate_limit
from schemas.models import ChatRequest
from services import gemini, openrouter
from services import groq_service, cerebras_service, sambanova_service, openai_service
from services.gemini import TEMPERATURE_PROFILES

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Grounded, professional system prompt ─────────────────────────────
DEFAULT_SYSTEM_PROMPT = """\
You are Pyxis, an advanced AI assistant built for professionals.

Principles:
- Be accurate — never hallucinate facts, citations, or URLs
- Be concise but complete — no padding or filler phrases
- Use markdown (headers, bullets, code blocks) when it aids clarity
- For code: always include language identifier in fenced blocks
- Acknowledge uncertainty rather than guessing\
"""

CODE_SYSTEM_PROMPT = """\
You are Pyxis Code, an expert software engineer.

Rules:
- Write production-quality code with proper error handling
- Always wrap code in fenced blocks with language identifiers
- Add brief inline comments for non-obvious logic
- Use idiomatic patterns for the requested language
- Never generate placeholder code — write real, working implementations\
"""

RESEARCH_SYSTEM_PROMPT = """\
You are Pyxis Research, an expert analyst.

Rules:
- Use clear headings and structured sections
- Distinguish known facts from inferences
- Provide balanced perspectives with supporting evidence
- Use tables for comparisons, bullets for lists
- Synthesize into actionable insights\
"""

PREMIUM_MODEL_PREFIXES = (
    "claude", "gpt-4", "gpt-3.5", "o1", "o3", "mistral-large",
)


def _detect_mode(system_prompt: str) -> str:
    sp = system_prompt.lower()
    if any(k in sp for k in ("code", "engineer", "software", "programming")):
        return "code"
    if any(k in sp for k in ("research", "analyst", "analysis", "investigate")):
        return "research"
    if any(k in sp for k in ("creative", "write", "story", "author", "novel")):
        return "creative"
    if any(k in sp for k in ("agent", "specialist", "expert advisor")):
        return "agent"
    return "chat"


def _get_user_keys(uid: str) -> dict:
    # Guests never have custom API keys — skip Firestore entirely
    if uid.startswith("guest_"):
        return {}

    # In-memory cache — avoids a Firestore round-trip on every message
    cached = _key_cache.get(uid)
    if cached and time.monotonic() - cached[1] < _KEY_CACHE_TTL:
        return cached[0]

    try:
        db = get_firestore()
        doc = db.document(f"users/{uid}/private/apikeys").get()
        keys = doc.to_dict() or {} if doc.exists else {}
        _key_cache[uid] = (keys, time.monotonic())
        return keys
    except Exception as e:
        logger.warning(f"Could not fetch user keys: {e}")
        return {}


def _log_provider_error(provider: str, model: str, error_type: str) -> None:
    """Fire-and-forget: log error for admin health dashboard."""
    try:
        get_firestore().collection("provider_errors").add({
            "provider": provider, "model": model,
            "error_code": error_type, "timestamp": SERVER_TIMESTAMP,
        })
    except Exception:
        pass


async def _track_usage(uid: str, model: str, latency_ms: int) -> None:
    """Non-blocking usage telemetry."""
    try:
        get_firestore().collection("usage_events").add({
            "uid": uid, "endpoint": "chat", "model": model,
            "latency_ms": latency_ms, "timestamp": SERVER_TIMESTAMP,
        })
    except Exception:
        pass


async def _provider_chain(
    req: ChatRequest,
    system_prompt: str,
    gemini_keys: list[str],
    groq_key: str,
    cerebras_key: str,
    sambanova_key: str,
    openai_key: str,
    openrouter_key: str,
    mode: str,
) -> AsyncGenerator[str, None]:
    def sse(token: str) -> str:
        return f"data: {json.dumps({'content': token})}\n\n"

    # Hard caps — prevent context-limit errors regardless of client behavior
    MAX_HISTORY   = 20
    MAX_MSG_CHARS = 15_000   # per-message cap in history
    MAX_INPUT     = 15_000   # current user message cap

    history = [
        {"role": m.role, "content": m.content[:MAX_MSG_CHARS]}
        for m in req.history[-MAX_HISTORY:]
    ]
    message = req.message[:MAX_INPUT]
    temp = TEMPERATURE_PROFILES.get(mode, 0.65)

    # ── Model-based direct routing (skip lower-priority providers) ──────
    model_id = (req.model or "").lower()
    # If user explicitly selected a Groq model, go there first
    if any(m in model_id for m in ("llama-3.3-70b-versatile", "llama-3.1-8b-instant", "groq/")):
        if groq_key:
            try:
                groq_model = req.model if "groq/" not in req.model else req.model.split("/", 1)[1]
                async for token in groq_service.stream_chat(
                    message, history, system_prompt, groq_key, mode=mode, model=groq_model,
                ):
                    yield sse(token)
                yield "data: [DONE]\n\n"
                return
            except Exception as e:
                logger.warning(f"Groq direct failed: {e}")
    # Cerebras direct routing
    elif any(m in model_id for m in ("llama3.3-70b", "llama3.1-8b", "cerebras/")):
        if cerebras_key:
            try:
                async for token in cerebras_service.stream_chat_with_fallback(
                    message, history, system_prompt, cerebras_key, mode=mode,
                ):
                    yield sse(token)
                yield "data: [DONE]\n\n"
                return
            except Exception as e:
                logger.warning(f"Cerebras direct failed: {e}")
    # OpenAI direct routing
    elif model_id.startswith(("gpt-", "o1", "o3")):
        if openai_key:
            try:
                async for token in openai_service.stream_chat(
                    message, history, system_prompt, openai_key, mode=mode, model=req.model,
                ):
                    yield sse(token)
                yield "data: [DONE]\n\n"
                return
            except Exception as e:
                logger.warning(f"OpenAI direct failed: {e}")
    # SambaNova direct routing
    elif any(m in model_id for m in ("meta-llama-3.3", "meta-llama-3.1", "sambanova/")):
        if sambanova_key:
            try:
                async for token in sambanova_service.stream_chat_with_fallback(
                    message, history, system_prompt, sambanova_key, mode=mode,
                ):
                    yield sse(token)
                yield "data: [DONE]\n\n"
                return
            except Exception as e:
                logger.warning(f"SambaNova direct failed: {e}")

    # ── Level 1: Gemini (primary — multi-key rotation + model fallback) ──
    if gemini_keys:
        try:
            async for token in gemini.stream_chat(
                message, req.model, history, system_prompt, gemini_keys,
                temperature=temp, mode=mode,
            ):
                yield sse(token)
            yield "data: [DONE]\n\n"
            return
        except Exception as e:
            logger.warning(f"Gemini failed: {type(e).__name__}: {e}")
            _log_provider_error("gemini", req.model, type(e).__name__)

    # ── Level 2: Groq (fast free — LPU hardware, ~500 tok/s) ─────────
    if groq_key:
        try:
            async for token in groq_service.stream_chat_with_fallback(
                message, history, system_prompt, groq_key, mode=mode,
            ):
                yield sse(token)
            yield "data: [DONE]\n\n"
            return
        except Exception as e:
            logger.warning(f"Groq failed: {type(e).__name__}: {e}")
            _log_provider_error("groq", "llama-3.3-70b-versatile", type(e).__name__)

    # ── Level 3: Cerebras (ultra-fast — 2000+ tok/s, wafer-scale) ────
    if cerebras_key:
        try:
            async for token in cerebras_service.stream_chat_with_fallback(
                message, history, system_prompt, cerebras_key, mode=mode,
            ):
                yield sse(token)
            yield "data: [DONE]\n\n"
            return
        except Exception as e:
            logger.warning(f"Cerebras failed: {type(e).__name__}: {e}")
            _log_provider_error("cerebras", "llama3.3-70b", type(e).__name__)

    # ── Level 4: SambaNova (fast free — wafer-scale inference) ──────
    if sambanova_key:
        try:
            async for token in sambanova_service.stream_chat_with_fallback(
                message, history, system_prompt, sambanova_key, mode=mode,
            ):
                yield sse(token)
            yield "data: [DONE]\n\n"
            return
        except Exception as e:
            logger.warning(f"SambaNova failed: {type(e).__name__}: {e}")
            _log_provider_error("sambanova", "Meta-Llama-3.3-70B-Instruct", type(e).__name__)

    # ── Level 5: OpenAI (gpt-4o-mini → gpt-4o, direct API) ──────────
    if openai_key:
        try:
            async for token in openai_service.stream_chat_with_fallback(
                message, history, system_prompt, openai_key, mode=mode,
            ):
                yield sse(token)
            yield "data: [DONE]\n\n"
            return
        except Exception as e:
            logger.warning(f"OpenAI failed: {type(e).__name__}: {e}")
            _log_provider_error("openai", "gpt-4o-mini", type(e).__name__)

    # ── Level 7: OpenRouter premium (Claude / GPT-4 / Mistral-Large) ──
    if openrouter_key and any(req.model.lower().startswith(p) for p in PREMIUM_MODEL_PREFIXES):
        try:
            async for token in openrouter.stream_chat(
                message, req.model, history, system_prompt, openrouter_key,
                temperature=temp, mode=mode,
            ):
                yield sse(token)
            yield "data: [DONE]\n\n"
            return
        except Exception as e:
            logger.warning(f"OpenRouter premium failed: {type(e).__name__}: {e}")
            _log_provider_error("openrouter_premium", req.model, type(e).__name__)

    # ── Level 8: OpenRouter free (last resort — always available) ─────
    if openrouter_key:
        try:
            async for token in openrouter.stream_chat_free(
                message, history, system_prompt, openrouter_key, mode=mode,
            ):
                yield sse(token)
            yield "data: [DONE]\n\n"
            return
        except Exception as e:
            logger.warning(f"OpenRouter free failed: {type(e).__name__}: {e}")
            _log_provider_error("openrouter_free", "free", type(e).__name__)

    yield f"data: {json.dumps({'error': 'All AI providers failed. Add API keys in Settings or configure GROQ_API_KEY / CEREBRAS_API_KEY / SAMBANOVA_API_KEY in .env'})}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/chat")
async def chat(
    req: ChatRequest,
    user: dict = Depends(check_rate_limit("chat")),
):
    t_start = time.monotonic()
    settings = get_settings()

    loop = asyncio.get_event_loop()
    user_keys = await loop.run_in_executor(None, _get_user_keys, user["uid"])

    # Gemini: user key overrides env, supports list for rotation
    user_gemini_key = user_keys.get("gemini", "")
    if user_gemini_key:
        gemini_keys = [user_gemini_key]
    else:
        gemini_keys = settings.gemini_keys_list

    groq_key       = user_keys.get("groq")       or settings.groq_api_key
    cerebras_key   = user_keys.get("cerebras")   or settings.cerebras_api_key
    sambanova_key  = user_keys.get("sambanova")  or settings.sambanova_api_key
    openai_key     = user_keys.get("openai")     or settings.openai_api_key
    openrouter_key = user_keys.get("openrouter") or settings.openrouter_api_key

    system_prompt = req.systemPrompt or DEFAULT_SYSTEM_PROMPT
    mode = _detect_mode(system_prompt)

    async def _generate():
        async for chunk in _provider_chain(
            req, system_prompt,
            gemini_keys, groq_key, cerebras_key, sambanova_key, openai_key, openrouter_key,
            mode,
        ):
            yield chunk
        latency = int((time.monotonic() - t_start) * 1000)
        asyncio.create_task(_track_usage(user["uid"], req.model, latency))

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
