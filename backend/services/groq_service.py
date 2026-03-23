"""
Groq LPU inference service — blazing fast, generous free tier.
OpenAI-compatible API: 14,400 RPD / 30 RPM per key (free tier).
Models: llama-3.3-70b-versatile (~500 tok/s), llama-3.1-8b-instant (~800 tok/s)

Get a free API key at: https://console.groq.com
"""

import asyncio
import json
import logging
from typing import AsyncGenerator

import httpx

logger = logging.getLogger(__name__)

GROQ_BASE = "https://api.groq.com/openai/v1"

# Ordered by quality — 70B first, 8B as speed fallback
GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
]

TEMPERATURE_PROFILES = {
    "chat": 0.70, "code": 0.15, "research": 0.40,
    "creative": 0.90, "agent": 0.75, "default": 0.65,
}


async def stream_chat(
    message: str,
    history: list[dict],
    system_prompt: str,
    api_key: str,
    mode: str = "chat",
    model: str = "llama-3.3-70b-versatile",
    timeout: float = 25.0,
) -> AsyncGenerator[str, None]:
    """
    Stream tokens from Groq. Raises on failure — caller handles fallback.
    Groq is OpenAI-compatible and extremely fast (LPU hardware).
    """
    temp = TEMPERATURE_PROFILES.get(mode, 0.65)

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history[-20:]:
        messages.append({
            "role": msg["role"],
            "content": msg["content"][:8000],
        })
    messages.append({"role": "user", "content": message})

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "max_tokens": 8192,
        "temperature": temp,
        "top_p": 0.95,
    }

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=8.0)
        ) as client:
            async with client.stream(
                "POST",
                f"{GROQ_BASE}/chat/completions",
                json=payload,
                headers=headers,
            ) as response:
                if response.status_code == 429:
                    raise ValueError("Groq: rate limited — trying next provider")
                if response.status_code == 401:
                    raise ValueError("Groq: invalid API key")
                if response.status_code == 413:
                    raise ValueError("Groq: request too large")
                if not response.is_success:
                    body = await response.aread()
                    raise ValueError(f"Groq HTTP {response.status_code}: {body[:200]}")

                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        choices = chunk.get("choices") or []
                        if not choices:
                            continue
                        delta = choices[0].get("delta") or {}
                        token = delta.get("content", "")
                        if token:
                            yield token
                    except (json.JSONDecodeError, KeyError):
                        continue

    except httpx.TimeoutException:
        raise TimeoutError(f"Groq {model} timed out after {timeout}s")
    except (ValueError, TimeoutError):
        raise
    except Exception as exc:
        raise RuntimeError(f"Groq error: {exc}") from exc


async def stream_chat_with_fallback(
    message: str,
    history: list[dict],
    system_prompt: str,
    api_key: str,
    mode: str = "chat",
) -> AsyncGenerator[str, None]:
    """
    Try Groq models in order: 70B (quality) → 8B (speed fallback).
    Returns after first successful streaming response.
    """
    for i, model in enumerate(GROQ_MODELS):
        try:
            tokens_seen = False
            async for token in stream_chat(
                message, history, system_prompt, api_key, mode, model
            ):
                tokens_seen = True
                yield token
            if tokens_seen:
                return
        except Exception as e:
            logger.warning(f"Groq {model} failed: {type(e).__name__}: {e}")
            if i < len(GROQ_MODELS) - 1:
                await asyncio.sleep(1)

    raise ValueError("All Groq models failed")
