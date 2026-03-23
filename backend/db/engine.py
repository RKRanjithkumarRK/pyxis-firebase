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

from core.config import get_settings

_settings = get_settings()

# Engine — created once at module import.
# Uses asyncpg driver for Postgres.
# Falls back to sqlite+aiosqlite for local dev if DATABASE_URL not set.
_database_url = _settings.database_url or "sqlite+aiosqlite:///./pyxis_dev.db"

# pool_size/max_overflow are only valid for Postgres (not SQLite)
_is_postgres = "postgresql" in _database_url or "postgres" in _database_url
_engine_kwargs: dict = {"echo": False, "pool_pre_ping": True}
if _is_postgres:
    _engine_kwargs.update({
        "pool_size": _settings.database_pool_size,
        "max_overflow": _settings.database_max_overflow,
        "pool_recycle": 3600,
    })

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
