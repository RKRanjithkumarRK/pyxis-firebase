"""
Google Gemini service — enterprise-grade with:
- Multi-key round-robin rotation (prevents quota exhaustion for many users)
- Direct REST API via httpx (no SDK global state — safe for concurrent requests)
- Automatic model fallback chain on quota/rate-limit errors
- Per-mode temperature control (code=precise, creative=expressive)
- History truncation to prevent context blowout

To add more Gemini keys (each has its own 15 RPM / 1500 RPD free quota):
  Set GEMINI_API_KEYS=key1,key2,key3 in .env
  Get free keys at: https://aistudio.google.com/app/apikey
"""

import asyncio
import itertools
import json
import logging
import os
import threading
from typing import AsyncGenerator

import httpx

logger = logging.getLogger(__name__)

# Semaphore: max concurrent Gemini requests across all keys/models
_gemini_semaphore = asyncio.Semaphore(64)

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

IMAGE_MODELS = [
    "gemini-2.0-flash-preview-image-generation",
    "gemini-2.0-flash-exp-image-generation",
    "gemini-2.0-flash-exp",
]

# Ordered fallback list for chat — tried in sequence on quota/rate-limit errors
CHAT_FALLBACK_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash-001",
]

# Per-use-case temperature profiles
TEMPERATURE_PROFILES = {
    "chat":     0.70,
    "code":     0.15,
    "research": 0.40,
    "creative": 0.90,
    "agent":    0.75,
    "default":  0.65,
}


# ── Multi-key pool — thread-safe round-robin ─────────────────────────────
class _KeyPool:
    """
    Thread-safe round-robin API key rotation.
    Each rotation gives the next key so concurrent requests spread across keys.
    On 429, caller should call next() to skip to next key.
    """
    def __init__(self, keys: list[str]):
        self._keys = keys[:]
        self._lock = threading.Lock()
        self._cycle = itertools.cycle(keys) if keys else None

    def next(self) -> str | None:
        if not self._keys:
            return None
        with self._lock:
            return next(self._cycle)

    def all_keys(self) -> list[str]:
        return self._keys[:]

    @property
    def size(self) -> int:
        return len(self._keys)


def _build_key_pool() -> _KeyPool:
    """Load Gemini keys from environment at import time."""
    keys: list[str] = []
    # Support GEMINI_API_KEYS=key1,key2,key3 for multiple key rotation
    multi = os.environ.get("GEMINI_API_KEYS", "").strip()
    if multi:
        keys.extend(k.strip() for k in multi.split(",") if k.strip())
    # Also support legacy single GEMINI_API_KEY
    single = os.environ.get("GEMINI_API_KEY", "").strip()
    if single and single not in keys:
        keys.append(single)
    return _KeyPool(keys)


_key_pool = _build_key_pool()


def _build_contents(history: list[dict], message: str) -> list[dict]:
    """Convert message list to Gemini REST API 'contents' format."""
    contents = []
    for msg in history:
        role = "user" if msg.get("role") == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg.get("content", "")}]})
    contents.append({"role": "user", "parts": [{"text": message}]})
    return contents


def _truncate_history(history: list[dict], max_chars: int = 40_000) -> list[dict]:
    """Keep most-recent messages that fit within max_chars budget."""
    if not history:
        return []
    total = 0
    kept = []
    for msg in reversed(history):
        chars = len(msg.get("content", ""))
        if total + chars > max_chars and kept:
            break
        kept.append(msg)
        total += chars
    return list(reversed(kept))


async def _stream_from_key(
    message: str,
    model_name: str,
    history: list[dict],
    system_prompt: str,
    api_key: str,
    temp: float,
    timeout: float,
) -> AsyncGenerator[str, None]:
    """
    Single attempt: stream from one Gemini model + one API key.
    Raises on error so caller can rotate to next key/model.
    """
    url = f"{GEMINI_BASE}/{model_name}:streamGenerateContent?key={api_key}&alt=sse"
    contents = _build_contents(history, message)

    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {
            "temperature": temp,
            "maxOutputTokens": 8192,
            "topP": 0.95,
            "topK": 40,
        },
    }

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=10.0)
        ) as client:
            async with client.stream("POST", url, json=payload) as response:
                if response.status_code == 429:
                    raise ValueError(f"Gemini {model_name}: rate limited (429)")
                if response.status_code in (400, 413):
                    body = await response.aread()
                    body_str = body.decode(errors="replace")
                    if any(k in body_str.lower() for k in (
                        "too many tokens", "request payload size", "context length",
                        "token", "limit", "large",
                    )):
                        raise OverflowError(f"Gemini {model_name}: context too large")
                    raise ValueError(f"Gemini {model_name}: HTTP 400: {body_str[:200]}")
                if not response.is_success:
                    body = await response.aread()
                    raise ValueError(f"Gemini {model_name}: HTTP {response.status_code}")

                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data in ("[DONE]", ""):
                        continue
                    try:
                        chunk = json.loads(data)
                        candidates = chunk.get("candidates") or []
                        if not candidates:
                            continue
                        parts = candidates[0].get("content", {}).get("parts", [])
                        for part in parts:
                            text = part.get("text", "")
                            if text:
                                yield text
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue

    except httpx.TimeoutException:
        raise TimeoutError(f"Gemini {model_name} timed out after {timeout}s")
    except (ValueError, OverflowError, TimeoutError):
        raise
    except Exception as exc:
        raise RuntimeError(f"Gemini {model_name} error: {exc}") from exc


async def stream_chat(
    message: str,
    model_id: str,
    history: list[dict],
    system_prompt: str,
    api_key: str | list[str],
    timeout: float = 30.0,
    temperature: float | None = None,
    mode: str = "chat",
) -> AsyncGenerator[str, None]:
    """
    Stream chat tokens from Gemini with:
    - Multi-key rotation: on 429, tries next key before falling to next model
    - Automatic model fallback: gemini-2.5-flash → 2.0-flash → 2.0-flash-lite → 2.0-flash-001
    - Per-mode temperature control
    - History truncation to prevent context blowout
    - Semaphore to prevent connection saturation
    """
    trimmed_history = _truncate_history(history, max_chars=40_000)
    temp = temperature if temperature is not None else TEMPERATURE_PROFILES.get(mode, 0.65)

    # Build key list: provided key(s) + any pool keys
    if isinstance(api_key, list):
        provided_keys = api_key
    else:
        provided_keys = [api_key] if api_key else []

    # Merge with pool keys (pool may have additional keys not in provided list)
    pool_keys = _key_pool.all_keys()
    all_keys: list[str] = []
    seen: set[str] = set()
    for k in provided_keys + pool_keys:
        if k and k not in seen:
            all_keys.append(k)
            seen.add(k)

    if not all_keys:
        raise ValueError("No Gemini API keys configured")

    requested = model_id if model_id.startswith("gemini") else "gemini-2.5-flash"
    models_to_try = [requested] + [m for m in CHAT_FALLBACK_MODELS if m != requested]

    last_exc: Exception = RuntimeError("No Gemini model available")

    async with _gemini_semaphore:
        for model_attempt, model_name in enumerate(models_to_try):
            # Try each key for this model before falling to next model
            key_exhausted = True
            for key_idx, key in enumerate(all_keys):
                try:
                    tokens_yielded = False
                    async for token in _stream_from_key(
                        message, model_name, trimmed_history,
                        system_prompt, key, temp, timeout,
                    ):
                        tokens_yielded = True
                        yield token

                    if tokens_yielded:
                        return  # Success — done

                    # Got no tokens but no error: try next key
                    logger.warning(f"Gemini {model_name} key[{key_idx}]: empty response")
                    key_exhausted = True

                except ValueError as e:
                    err = str(e).lower()
                    if "429" in err or "rate" in err or "quota" in err or "exhausted" in err:
                        logger.warning(
                            f"Gemini {model_name} key[{key_idx}] rate-limited → "
                            f"{'next key' if key_idx < len(all_keys)-1 else 'next model'}"
                        )
                        last_exc = e
                        key_exhausted = (key_idx == len(all_keys) - 1)
                        continue  # try next key
                    else:
                        raise  # non-rate-limit error: propagate

                except OverflowError as e:
                    # Context too large — trim more aggressively and try next model
                    logger.warning(f"Gemini {model_name}: context too large → next model")
                    last_exc = e
                    key_exhausted = True
                    break  # skip remaining keys for this model

                except TimeoutError as e:
                    logger.warning(f"Gemini {model_name} key[{key_idx}]: timeout")
                    last_exc = e
                    key_exhausted = (key_idx == len(all_keys) - 1)
                    continue

                except Exception as e:
                    last_exc = e
                    raise  # unexpected error: propagate

            if not key_exhausted:
                return  # success from one of the keys

            # All keys exhausted for this model — wait before next model
            if model_attempt < len(models_to_try) - 1:
                backoff = min(2 ** model_attempt, 6)
                logger.info(f"All keys exhausted on {model_name}, waiting {backoff}s → next model")
                await asyncio.sleep(backoff)

    raise last_exc


async def generate_image(prompt: str, api_key: str, timeout: float = 8.0) -> str | None:
    """
    Try Gemini image generation models in order.
    Returns data URI string on success, None if all models unavailable.
    """
    # Use provided key or first pool key
    key = api_key or (_key_pool.next() if _key_pool.size > 0 else None)
    if not key:
        return None

    async with httpx.AsyncClient(timeout=timeout) as client:
        for model in IMAGE_MODELS:
            url = f"{GEMINI_BASE}/{model}:generateContent?key={key}"
            try:
                resp = await client.post(
                    url,
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]},
                    },
                )

                if resp.status_code in (404, 400):
                    logger.info(f"Gemini image {model}: {resp.status_code} — skipping")
                    continue
                if resp.status_code == 429:
                    logger.warning(f"Gemini image {model}: rate limited")
                    return None
                if not resp.is_success:
                    logger.warning(f"Gemini image {model}: HTTP {resp.status_code}")
                    continue

                parts = (
                    resp.json()
                    .get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [])
                )
                img = next((p for p in parts if p.get("inlineData", {}).get("data")), None)
                if img:
                    mime = img["inlineData"]["mimeType"]
                    b64 = img["inlineData"]["data"]
                    logger.info(f"Gemini image OK: {model}")
                    return f"data:{mime};base64,{b64}"

                logger.info(f"Gemini image {model}: response OK but no image part")

            except httpx.TimeoutException:
                logger.warning(f"Gemini image {model}: timeout after {timeout}s")
                return None
            except Exception as exc:
                logger.warning(f"Gemini image {model}: {exc}")

    return None
