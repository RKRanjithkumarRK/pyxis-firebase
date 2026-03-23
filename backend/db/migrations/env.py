"""
Alembic env.py — Pyxis One async migrations.

Supports both:
  • offline mode  (emit SQL to stdout, no live DB required)
  • online mode   (async SQLAlchemy engine against Postgres or SQLite)
"""

import asyncio
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# ── make sure 'backend/' is on sys.path so our packages resolve ──────
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

# ── import Alembic config ─────────────────────────────────────────────
config = context.config

# ── configure Python logging from the ini file ───────────────────────
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── import all models so Alembic can autogenerate ────────────────────
import db.models  # noqa: F401  (registers all ORM models with Base.metadata)
from db.base import Base

target_metadata = Base.metadata

# ── read DATABASE_URL from env / Settings (overrides alembic.ini) ────
def _get_url() -> str:
    # 1. Explicit env var takes priority
    url = os.environ.get("DATABASE_URL", "")
    if url:
        # asyncpg driver for async engine
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url

    # 2. Try loading from Settings (reads .env file)
    try:
        from core.config import get_settings
        s = get_settings()
        if s.database_url:
            return s.database_url
    except Exception:
        pass

    # 3. Fallback to SQLite for local dev
    return "sqlite+aiosqlite:///./pyxis_dev.db"


# ── offline migrations ────────────────────────────────────────────────
def run_migrations_offline() -> None:
    """Emit SQL to stdout without a live connection."""
    url = _get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # required for SQLite ALTER TABLE
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ── online migrations (async) ─────────────────────────────────────────
def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine and run migrations in online mode."""
    url = _get_url()
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = url

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
