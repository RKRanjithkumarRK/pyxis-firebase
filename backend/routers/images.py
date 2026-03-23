"""
Images router.
POST /api/images       — generate image (requires auth)
GET  /api/images/proxy — proxy external image bytes (NO auth — used by <img> tags)
"""

import logging
import urllib.parse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from core.auth import verify_token
from core.config import get_settings
from core.firebase import get_firestore
from schemas.models import ImageRequest, ImageResponse
from services.image_gen import generate, normalize_size

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_HOSTS = {
    "image.pollinations.ai",
    "cdn.openai.com",
    "oaidalleapiprodscus.blob.core.windows.net",
    "stablehorde.net",
    "picsum.photos",
}


def _user_keys(uid: str) -> dict:
    if uid.startswith("guest_"):
        return {}
    try:
        db = get_firestore()
        doc = db.document(f"users/{uid}/private/apikeys").get()
        return doc.to_dict() or {} if doc.exists else {}
    except Exception:
        return {}


@router.post("/images", response_model=ImageResponse)
async def generate_image(req: ImageRequest, user: dict = Depends(verify_token)):
    settings = get_settings()
    keys = _user_keys(user["uid"])

    w, h = normalize_size(req.width, req.height)
    result = await generate(
        prompt=req.prompt,
        width=w,
        height=h,
        gemini_key=keys.get("gemini") or settings.gemini_api_key,
        openai_key=keys.get("openai") or settings.openai_api_key,
        hf_key=keys.get("huggingface") or settings.huggingface_api_key,
    )
    return ImageResponse(url=result.url, prompt=req.prompt, source=result.source)


@router.get("/images/proxy")
async def proxy_image(url: str = Query(...)):
    """
    Proxy an image from an allow-listed host.
    No auth required — this endpoint is called by browser <img> tags.
    SSRF protection: only hosts in ALLOWED_HOSTS are permitted.
    """
    try:
        host = urllib.parse.urlparse(url).netloc.lower()
        if not any(host == h or host.endswith("." + h) for h in ALLOWED_HOSTS):
            raise HTTPException(403, f"Host not allowed: {host}")

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(url)

        if not resp.is_success:
            raise HTTPException(502, "Upstream image fetch failed")

        return Response(
            content=resp.content,
            media_type=resp.headers.get("content-type", "image/png"),
            headers={"Cache-Control": "public, max-age=3600"},
        )

    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(504, "Image service slow — try again")
    except Exception as exc:
        logger.error(f"Proxy error: {exc}")
        raise HTTPException(500, "Proxy failed")
