"""
Cerebras wafer-scale inference — 2000+ tokens/sec, generous free tier.
OpenAI-compatible API. One of the fastest LLM inference services available.
Models: llama3.3-70b (smart), llama3.1-8b (ultra-fast)

Get a free API key at: https://cloud.cerebras.ai
"""

import asyncio
import json
import logging
from typing import AsyncGenerator

import httpx

logger = logging.getLogger(__name__)

CEREBRAS_BASE = "https://api.cerebras.ai/v1"

# Ordered by quality — 70B first, 8B as ultra-fast fallback
CEREBRAS_MODELS = [
    "llama3.3-70b",
    "llama3.1-8b",
]

TEMPERATURE_PROFILES = {
    "chat": 0.70, "code": 0.15, "research": 0.40,
    "creative": 0.90, "agent": 0.75, "default": 0.65,
}

# Cerebras max temperature is 1.5
_MAX_TEMP = 1.5


async def stream_chat(
    message: str,
    history: list[dict],
    system_prompt: str,
    api_key: str,
    mode: str = "chat",
    model: str = "llama3.3-70b",
    timeout: float = 25.0,
) -> AsyncGenerator[str, None]:
    """
    Stream tokens from Cerebras. Raises on failure — caller handles fallback.
    Cerebras uses wafer-scale chips delivering 2000+ tok/s — fastest available.
    """
    temp = min(TEMPERATURE_PROFILES.get(mode, 0.65), _MAX_TEMP)

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
        "max_completion_tokens": 8192,
        "temperature": temp,
        "top_p": 0.95,
    }

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=8.0)
        ) as client:
            async with client.stream(
                "POST",
                f"{CEREBRAS_BASE}/chat/completions",
                json=payload,
                headers=headers,
            ) as response:
                if response.status_code == 429:
                    raise ValueError("Cerebras: rate limited — trying next provider")
                if response.status_code == 401:
                    raise ValueError("Cerebras: invalid API key")
                if response.status_code == 413:
                    raise ValueError("Cerebras: request too large")
                if not response.is_success:
                    body = await response.aread()
                    raise ValueError(f"Cerebras HTTP {response.status_code}: {body[:200]}")

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
        raise TimeoutError(f"Cerebras {model} timed out after {timeout}s")
    except (ValueError, TimeoutError):
        raise
    except Exception as exc:
        raise RuntimeError(f"Cerebras error: {exc}") from exc


async def stream_chat_with_fallback(
    message: str,
    history: list[dict],
    system_prompt: str,
    api_key: str,
    mode: str = "chat",
) -> AsyncGenerator[str, None]:
    """
    Try Cerebras models in order: 70B (quality) → 8B (ultra-fast fallback).
    Returns after first successful streaming response.
    """
    for i, model in enumerate(CEREBRAS_MODELS):
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
            logger.warning(f"Cerebras {model} failed: {type(e).__name__}: {e}")
            if i < len(CEREBRAS_MODELS) - 1:
                await asyncio.sleep(0.5)

    raise ValueError("All Cerebras models failed")
