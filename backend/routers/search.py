"""
Search router — web search via DuckDuckGo HTML scraping + Wikipedia fallback.
No API key required.
"""

import logging
import re

import httpx
from fastapi import APIRouter, Depends, Query

from core.auth import verify_token
from schemas.models import SearchResult

logger = logging.getLogger(__name__)
router = APIRouter()


async def _duckduckgo_search(query: str) -> list[SearchResult]:
    """Scrape DuckDuckGo HTML results."""
    results = []
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers={"User-Agent": "Mozilla/5.0 (compatible; Pyxis/1.0)"},
            )
            if not resp.is_success:
                return results

            html = resp.text
            # Extract result blocks
            blocks = re.findall(
                r'<a class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?'
                r'<a class="result__snippet"[^>]*>(.*?)</a>',
                html,
                re.DOTALL,
            )
            for url, title, snippet in blocks[:6]:
                clean_title = re.sub(r"<[^>]+>", "", title).strip()
                clean_snippet = re.sub(r"<[^>]+>", "", snippet).strip()
                if clean_title and clean_snippet:
                    results.append(SearchResult(title=clean_title, snippet=clean_snippet, url=url))
    except Exception as e:
        logger.warning(f"DuckDuckGo scrape failed: {e}")
    return results


async def _wikipedia_search(query: str) -> list[SearchResult]:
    """Wikipedia search API as fallback."""
    results = []
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query",
                    "list": "search",
                    "srsearch": query,
                    "format": "json",
                    "srlimit": 3,
                },
            )
            if resp.is_success:
                data = resp.json()
                for item in data.get("query", {}).get("search", []):
                    results.append(SearchResult(
                        title=item["title"],
                        snippet=re.sub(r"<[^>]+>", "", item.get("snippet", "")),
                        url=f"https://en.wikipedia.org/wiki/{item['title'].replace(' ', '_')}",
                    ))
    except Exception as e:
        logger.warning(f"Wikipedia search failed: {e}")
    return results


@router.get("/search", response_model=list[SearchResult])
async def search(
    q: str = Query(..., description="Search query"),
    user: dict = Depends(verify_token),
):
    results = await _duckduckgo_search(q)
    if not results:
        results = await _wikipedia_search(q)
    # Return empty list (not 404) so the Research page continues with AI synthesis
    return results
