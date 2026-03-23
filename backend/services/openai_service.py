"""
OpenAI service — GPT-4o and GPT-4o-mini via direct OpenAI API.
Fast, reliable paid provider used when free tiers are exhausted.
"""

import asyncio
import json
import logging
from typing import AsyncGenerator

import httpx

logger = logging.getLogger(__name__)

OPENAI_BASE = "https://api.openai.com/v1"

# Models in priority order: smart → fast fallback
OPENAI_MODELS = [
    "gpt-4o-mini",   # fast + cheap — handles 90% of requests well
    "gpt-4o",        # smartest — reserved for when mini fails
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
    model: str = "gpt-4o-mini",
    timeout: float = 30.0,
) -> AsyncGenerator[str, None]:
    """Stream tokens from OpenAI. Raises on failure — caller handles fallback."""
    temp = TEMPERATURE_PROFILES.get(mode, 0.65)

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history[-20:]:
        messages.append({"role": msg["role"], "content": msg["content"][:8000]})
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
                f"{OPENAI_BASE}/chat/completions",
                json=payload,
                headers=headers,
            ) as response:
                if response.status_code == 429:
                    raise ValueError("OpenAI: rate limited")
                if response.status_code == 401:
                    raise ValueError("OpenAI: invalid API key")
                if response.status_code == 402:
                    raise ValueError("OpenAI: insufficient credits")
                if not response.is_success:
                    body = await response.aread()
                    raise ValueError(f"OpenAI HTTP {response.status_code}: {body[:200]}")

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
        raise TimeoutError(f"OpenAI {model} timed out after {timeout}s")
    except (ValueError, TimeoutError):
        raise
    except Exception as exc:
        raise RuntimeError(f"OpenAI error: {exc}") from exc


async def stream_chat_with_fallback(
    message: str,
    history: list[dict],
    system_prompt: str,
    api_key: str,
    mode: str = "chat",
) -> AsyncGenerator[str, None]:
    """Try gpt-4o-mini first, fall back to gpt-4o."""
    for i, model in enumerate(OPENAI_MODELS):
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
            logger.warning(f"OpenAI {model} failed: {type(e).__name__}: {e}")
            if i < len(OPENAI_MODELS) - 1:
                await asyncio.sleep(0.3)

    raise ValueError("All OpenAI models failed")
