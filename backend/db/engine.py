"""Async SQLAlchemy engine + session factory.

Usage in FastAPI:
    @router.get("/items")
    async def list_items(db: AsyncSession = Depends(get_db)):
        result = await db.execute(select(Item))
        return result.scalars().all()
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from urllib.parse import urlparse, urlunparse, urlencode, parse_qs

from core.config import get_settings

_settings = get_settings()


def _build_postgres_url(raw: str) -> tuple[str, dict]:
    """
    Convert a plain postgres:// URL to postgresql+asyncpg://.
    asyncpg does not accept sslmode / channel_binding as URL params —
    strip them and pass ssl=True as a connect_arg instead.
    Returns (cleaned_url, connect_args).
    """
    # Normalise scheme
    url = raw
    for old, new in (
        ("postgres://", "postgresql+asyncpg://"),
        ("postgresql://", "postgresql+asyncpg://"),
    ):
        if url.startswith(old):
            url = new + url[len(old):]
            break

    parsed = urlparse(url)
    qs = parse_qs(parsed.query, keep_blank_values=True)

    # Determine SSL requirement from URL params before stripping them
    needs_ssl = qs.pop("sslmode", [""])[0] in ("require", "verify-ca", "verify-full")
    qs.pop("channel_binding", None)   # not supported by asyncpg

    clean_query = urlencode({k: v[0] for k, v in qs.items()})
    clean_url = urlunparse(parsed._replace(query=clean_query))

    connect_args = {"ssl": True} if needs_ssl else {}
    return clean_url, connect_args


# Engine — created once at module import.
_raw_url = _settings.database_url or "sqlite+aiosqlite:///./pyxis_dev.db"
_is_postgres = "postgresql" in _raw_url or "postgres" in _raw_url

_engine_kwargs: dict = {"echo": False, "pool_pre_ping": True}

if _is_postgres:
    _database_url, _connect_args = _build_postgres_url(_raw_url)
    _engine_kwargs.update({
        "pool_size": _settings.database_pool_size,
        "max_overflow": _settings.database_max_overflow,
        "pool_recycle": 3600,
        "connect_args": _connect_args,
    })
else:
    _database_url = _raw_url

async_engine: AsyncEngine = create_async_engine(_database_url, **_engine_kwargs)

async_session_factory = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields an async DB session, auto-closes after request."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
