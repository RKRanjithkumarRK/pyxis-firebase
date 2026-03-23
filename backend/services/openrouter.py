"""
OpenRouter service — enterprise-grade streaming for 100+ AI models.
Features: temperature control, retry with backoff, provider health logging.
"""

import asyncio
import json
import logging
from typing import AsyncGenerator

import httpx

logger = logging.getLogger(__name__)

OPENROUTER_BASE = "https://openrouter.ai/api/v1"

# Free models — ordered by response speed (fastest first)
FREE_MODELS = [
    "liquid/lfm-2.5-1.2b-instruct:free",        # 1.2B params — ultra fast
    "google/gemma-3n-e2b-it:free",               # Gemma 3n E2B — very fast
    "stepfun/step-3.5-flash:free",               # Flash variant — fast
    "mistralai/mistral-small-3.1-24b-instruct:free",  # 24B — balanced
    "meta-llama/llama-3.3-70b-instruct:free",    # 70B — smartest but slower
]

# Per-use-case temperature matching Gemini profiles
TEMPERATURE_PROFILES = {
    "chat":     0.70,
    "code":     0.15,
    "research": 0.40,
    "creative": 0.90,
    "agent":    0.75,
    "default":  0.65,
}


async def stream_chat(
    message: str,
    model_id: str,
    history: list[dict],
    system_prompt: str,
    api_key: str,
    timeout: float = 30.0,
    temperature: float | None = None,
    mode: str = "chat",
) -> AsyncGenerator[str, None]:
    """
    Stream chat from OpenRouter with SSE parsing.
    Raises on failure — caller handles fallback.
    """
    temp = temperature if temperature is not None else TEMPERATURE_PROFILES.get(mode, 0.65)

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history[-20:]:   # Cap at 20 messages to prevent token bloat
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": message})

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://pyxis-firebase.vercel.app",
        "X-Title": "Pyxis One",
    }

    payload = {
        "model": model_id,
        "messages": messages,
        "stream": True,
        "max_tokens": 8192,
        "temperature": temp,
        "top_p": 0.95,
    }

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=10.0)
        ) as client:
            async with client.stream(
                "POST",
                f"{OPENROUTER_BASE}/chat/completions",
                json=payload,
                headers=headers,
            ) as response:
                if response.status_code == 402:
                    raise ValueError("OpenRouter: insufficient credits")
                if response.status_code == 429:
                    raise ValueError("OpenRouter: rate limited")
                if response.status_code == 404:
                    raise ValueError(f"OpenRouter: model '{model_id}' not found")
                if not response.is_success:
                    body = await response.aread()
                    raise ValueError(f"OpenRouter HTTP {response.status_code}: {body[:200]}")

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
        raise TimeoutError(f"OpenRouter {model_id} timed out after {timeout}s")
    except (ValueError, TimeoutError):
        raise
    except Exception as exc:
        raise RuntimeError(f"OpenRouter error: {exc}") from exc


async def stream_chat_free(
    message: str,
    history: list[dict],
    system_prompt: str,
    api_key: str,
    mode: str = "chat",
) -> AsyncGenerator[str, None]:
    """
    Try free models in order with increasing timeouts.
    Returns after first successful response.
    """
    timeouts = [15.0, 20.0, 25.0, 25.0, 25.0]

    for i, (model, timeout) in enumerate(zip(FREE_MODELS, timeouts)):
        try:
            tokens_seen = False
            async for token in stream_chat(
                message, model, history, system_prompt, api_key,
                timeout=timeout, mode=mode,
            ):
                tokens_seen = True
                yield token
            if tokens_seen:
                return
        except Exception as e:
            logger.warning(f"OpenRouter free {model} failed: {type(e).__name__}: {e}")
            if i < len(FREE_MODELS) - 1:
                await asyncio.sleep(min(2 ** i, 6))  # 1s, 2s, 4s, 6s
            continue

    raise ValueError("All OpenRouter free models failed — check your OpenRouter API key")
