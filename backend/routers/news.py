"""
News router — aggregates news headlines via DuckDuckGo search.
"""

import logging

import httpx
from fastapi import APIRouter, Depends, Query

from core.auth import verify_token
from schemas.models import SearchResult

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/news", response_model=list[SearchResult])
async def get_news(
    topic: str = Query(default="technology"),
    user: dict = Depends(verify_token),
):
    """Fetch top news for a topic via DuckDuckGo."""
    from routers.search import _duckduckgo_search
    results = await _duckduckgo_search(f"{topic} news today")
    return results[:6]
