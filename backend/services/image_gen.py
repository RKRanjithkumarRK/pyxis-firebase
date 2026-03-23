"""
Image generation service.

Priority:
  1. HuggingFace FLUX.1-schnell (if hf_key — fastest, best quality)
  2. DALL-E 3 via OpenAI (if openai_key)
  3. Gemini image generation (if gemini_key)
  4. Pollinations.ai — free, instant, no key needed (always available fallback)

AI Horde is NOT used: it queues for 30-90 seconds which is unacceptable UX.
Pollinations.ai returns a direct URL the browser loads immediately (~3-8s).
"""

import asyncio
import base64
import logging
import random
import urllib.parse
from dataclasses import dataclass

import httpx

from .gemini import generate_image as _gemini_image

logger = logging.getLogger(__name__)


@dataclass
class ImageResult:
    url: str
    source: str


def normalize_size(width: int, height: int, max_edge: int = 1024) -> tuple[int, int]:
    w = max(width, 64) if isinstance(width, int) else 512
    h = max(height, 64) if isinstance(height, int) else 512
    biggest = max(w, h)
    if biggest <= max_edge:
        return w, h
    scale = max_edge / biggest
    return max(256, round(w * scale)), max(256, round(h * scale))


def pollinations_proxy_url(prompt: str, width: int, height: int) -> str:
    """
    Returns a backend-proxied Pollinations URL.
    Routes through /api/images/proxy to avoid browser ORB/CORS blocking.
    The proxy fetches from Pollinations and returns image bytes directly.

    IMPORTANT: prompt must NOT be pre-encoded here — quote() encodes it once
    for the `url` query parameter. Pre-encoding causes %2520 double-encoding.
    """
    seed = random.randint(1, 999_999)
    w = min(width, 1024)
    h = min(height, 1024)
    # Use raw (unencoded) prompt — quote() will encode it exactly once below
    upstream = (
        f"https://image.pollinations.ai/prompt/{prompt}"
        f"?model=flux&width={w}&height={h}&seed={seed}&nologo=true"
    )
    # Encode the full upstream URL as a query parameter value (safe='' encodes everything)
    return f"/api/images/proxy?url={urllib.parse.quote(upstream, safe='')}"


async def _try_gemini(prompt: str, key: str) -> ImageResult | None:
    try:
        url = await _gemini_image(prompt, key, timeout=12.0)
        return ImageResult(url=url, source="gemini") if url else None
    except Exception as exc:
        logger.warning(f"Gemini image error: {exc}")
        return None


async def _try_openai(prompt: str, key: str) -> ImageResult | None:
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/images/generations",
                headers={"Authorization": f"Bearer {key}"},
                json={"model": "dall-e-3", "prompt": prompt, "n": 1, "size": "1024x1024"},
            )
            if resp.is_success:
                url = resp.json()["data"][0]["url"]
                return ImageResult(url=url, source="openai")
            logger.warning(f"DALL-E HTTP {resp.status_code}")
    except Exception as exc:
        logger.warning(f"DALL-E error: {exc}")
    return None


# HuggingFace Inference Router models (replaces deprecated api-inference.huggingface.co)
HF_MODELS = [
    "black-forest-labs/FLUX.1-schnell",     # Fast, high quality (~3-5s)
    "stabilityai/stable-diffusion-3.5-large",
    "black-forest-labs/FLUX.1-dev",
]


async def _try_huggingface(prompt: str, key: str) -> ImageResult | None:
    """Use HuggingFace router endpoint (new API, replaces deprecated inference API)."""
    async with httpx.AsyncClient(timeout=40.0) as client:
        for model in HF_MODELS:
            try:
                resp = await client.post(
                    f"https://router.huggingface.co/hf-inference/models/{model}",
                    headers={"Authorization": f"Bearer {key}"},
                    json={"inputs": prompt},
                )
                ct = resp.headers.get("content-type", "")
                if resp.is_success and ct.startswith("image"):
                    ext = "jpeg" if "jpeg" in ct else "png"
                    b64 = base64.b64encode(resp.content).decode()
                    logger.info(f"HuggingFace router OK: {model}")
                    return ImageResult(url=f"data:image/{ext};base64,{b64}", source="huggingface")
                if resp.status_code in (404, 410):
                    logger.info(f"HuggingFace {model}: {resp.status_code} — skipping")
                    continue
                if resp.status_code == 503:
                    # Model loading — wait and retry once
                    logger.info(f"HuggingFace {model}: loading, waiting 5s")
                    await asyncio.sleep(5)
                    continue
                logger.warning(f"HuggingFace {model} HTTP {resp.status_code}: {resp.text[:120]}")
            except Exception as exc:
                logger.warning(f"HuggingFace {model} error: {exc}")
    return None


async def generate(
    prompt: str,
    width: int,
    height: int,
    gemini_key: str = "",
    openai_key: str = "",
    hf_key: str = "",
) -> ImageResult:
    """
    Race all configured providers; return the FIRST successful (non-None) result.
    Priority order: HuggingFace FLUX → OpenAI DALL-E → Gemini → Pollinations fallback.

    Bug fix: asyncio.FIRST_COMPLETED returns on ANY completion (even None/failures).
    We use a loop to keep waiting until we get a real image or all tasks are done.
    """
    w, h = normalize_size(width, height)

    # HF first (FLUX.1-schnell is fastest and always works with a key)
    tasks: list[asyncio.Task] = []
    if hf_key:
        tasks.append(asyncio.create_task(_try_huggingface(prompt, hf_key)))
    if openai_key:
        tasks.append(asyncio.create_task(_try_openai(prompt, openai_key)))
    if gemini_key:
        tasks.append(asyncio.create_task(_try_gemini(prompt, gemini_key)))

    # No keys → instant Pollinations fallback
    if not tasks:
        logger.info("No API keys — returning Pollinations direct URL")
        return ImageResult(url=pollinations_proxy_url(prompt, w, h), source="pollinations")

    # Keep iterating completed tasks until we get a real image or all are done
    deadline = asyncio.get_event_loop().time() + 45.0
    pending = set(tasks)

    while pending:
        time_left = deadline - asyncio.get_event_loop().time()
        if time_left <= 0:
            logger.warning("Image gen: all providers timed out")
            break

        done, pending = await asyncio.wait(
            pending, timeout=time_left, return_when=asyncio.FIRST_COMPLETED
        )

        if not done:  # timed out waiting
            break

        for t in done:
            try:
                result = t.result()
                if result is not None:
                    logger.info(f"Image from: {result.source}")
                    # Cancel any still-running tasks
                    for p in pending:
                        p.cancel()
                    return result
            except Exception as exc:
                logger.warning(f"Provider task error: {exc}")

    # Cancel leftovers
    for t in pending:
        t.cancel()

    # All providers failed → Pollinations fallback
    logger.info("All API providers failed — using Pollinations direct URL")
    return ImageResult(url=pollinations_proxy_url(prompt, w, h), source="pollinations")
