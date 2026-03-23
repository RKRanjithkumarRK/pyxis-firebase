"""
Pyxis One — Python backend + React frontend.
FastAPI serves all /api/* routes.
In dev: React runs on Vite (port 3000) and proxies /api/* to this server.
In prod: React is built to backend/static/dist and served as a SPA.

Run backend:
    cd backend
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

Run frontend (dev):
    cd frontend
    npm install && npm run dev      # http://localhost:3000

Build for production:
    cd frontend && npm run build    # outputs to backend/static/dist
    # then just run the backend — it serves the built React app
"""

import logging
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from core.config import get_settings
from routers import (
    admin,
    agent_memory,
    chat,
    chat_tools,
    conversations,
    guest,
    images,
    keys,
    messages,
    news,
    parse_file,
    profile,
    projects,
    projects_sources,
    prompts,
    run,
    schedules,
    search,
    terminal,
    tool_chat,
    transcribe,
    voice,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()


# ── Lifespan (replaces deprecated on_event) ───────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info("Pyxis One — Python Backend starting up")
    logger.info(f"Environment:     {settings.environment}")
    logger.info(f"Gemini key:      {'✓' if settings.gemini_api_key else '✗ missing'}")
    logger.info(f"OpenRouter key:  {'✓' if settings.openrouter_api_key else '✗ missing'}")
    logger.info(f"OpenAI key:      {'✓' if settings.openai_api_key else '✗ missing'}")
    logger.info(f"HuggingFace key: {'✓' if settings.huggingface_api_key else '✗ missing'}")

    # Database warm-up (if Postgres is configured)
    if settings.database_url:
        try:
            from db.engine import async_engine
            async with async_engine.connect() as conn:
                from sqlalchemy import text
                await conn.execute(text("SELECT 1"))
            logger.info("Database:        ✓ Postgres connected")
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"Database:        ✗ {exc}")
    else:
        logger.info("Database:        SQLite fallback (set DATABASE_URL for Postgres)")

    # Redis health-check (non-blocking)
    try:
        from core.redis import get_redis
        r = await get_redis()
        await r.ping()
        logger.info("Redis:           ✓ connected")
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Redis:           ✗ {exc} (caching disabled)")

    # Casbin ABAC — seed default policies (idempotent)
    try:
        from core.abac import seed_default_policies
        seed_default_policies()
        logger.info("Casbin:          ✓ policies seeded")
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Casbin:          ✗ {exc}")

    # MCP Gateway — always register built-in tools, then load DB servers
    try:
        from mcp.gateway import get_gateway, McpServerConfig

        gateway = get_gateway()

        # ── Always register the built-in tool server ──────────────────
        gateway.register(McpServerConfig(slug="builtin", transport="builtin"))
        await gateway.connect("builtin")
        builtin_count = len(gateway.list_tools("builtin"))
        logger.info(f"MCP Builtin:     ✓ {builtin_count} built-in tools registered")

        # ── Load any DB-registered servers ────────────────────────────
        try:
            from db.engine import async_session_factory
            from db.models.mcp_server import McpServer
            from sqlalchemy import select

            async with async_session_factory() as db:
                result = await db.execute(select(McpServer).where(McpServer.is_active == True))
                servers = result.scalars().all()
                for s in servers:
                    gateway.register(McpServerConfig(
                        slug=s.slug,
                        transport=s.transport,
                        command=s.command,
                        args=s.args or [],
                        env_vars=s.env_vars or {},
                        url=s.url,
                        auth_config=s.auth_config or {},
                    ))
            if servers:
                results = await gateway.connect_all()
                healthy = sum(1 for ok in results.values() if ok)
                logger.info(f"MCP Gateway:     ✓ {healthy}/{len(results)} DB servers connected")
        except Exception as db_exc:  # noqa: BLE001
            logger.info(f"MCP Gateway:     DB servers skipped ({db_exc})")

    except Exception as exc:  # noqa: BLE001
        logger.warning(f"MCP Gateway:     ✗ {exc}")

    logger.info("Open in browser: http://localhost:8000")
    logger.info("API docs:        http://localhost:8000/docs")
    logger.info("=" * 60)

    yield  # ←─── app runs here ─────────────────────────────────────

    # ── Shutdown ─────────────────────────────────────────────────────
    logger.info("Pyxis One — shutting down…")
    if settings.database_url:
        try:
            from db.engine import async_engine
            await async_engine.dispose()
            logger.info("Database connection pool closed.")
        except Exception:  # noqa: BLE001
            pass
    try:
        from core.redis import close_redis
        await close_redis()
        logger.info("Redis connection closed.")
    except Exception:  # noqa: BLE001
        pass
    try:
        from mcp.gateway import close_gateway
        from sessions.service import close_http_client
        await close_gateway()
        await close_http_client()
        logger.info("MCP gateway + HTTP client closed.")
    except Exception:  # noqa: BLE001
        pass


# ── App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Pyxis API",
    description="AI-powered productivity platform — 100% Python",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── GZip compression (responses > 1 KB) ──────────────────────────────
app.add_middleware(GZipMiddleware, minimum_size=1024)

# ── CORS ─────────────────────────────────────────────────────────────
_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "https://pyxis-firebase.vercel.app",
    "https://pyxis-one.web.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_origin_regex=r"https://(pyxis.*\.vercel\.app|ranjithkumarRK.*\.hf\.space|.*\.hf\.space)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-Id", "X-Process-Time"],
)


# ── Request-ID + latency middleware ──────────────────────────────────
@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-Id", str(uuid.uuid4()))
    request.state.request_id = request_id
    t0 = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled error [%s]: %s", request_id, exc)
        # Scrub API keys from any error detail that might leak through
        response = JSONResponse(status_code=500, content={"detail": "Internal server error"})
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
    response.headers["X-Request-Id"] = request_id
    response.headers["X-Process-Time"] = f"{elapsed_ms}ms"
    return response


# ── Static files ──────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
DIST_DIR = BASE_DIR / "static" / "dist"

_static_dir = BASE_DIR / "static"
_static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=_static_dir), name="static")

if (DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")


# ── Legacy API routes (/api/*) ─────────────────────────────────────────
PREFIX = "/api"

app.include_router(chat.router,             prefix=PREFIX, tags=["Chat"])
app.include_router(images.router,           prefix=PREFIX, tags=["Images"])
app.include_router(messages.router,         prefix=PREFIX, tags=["Messages"])
app.include_router(conversations.router,    prefix=PREFIX, tags=["Conversations"])
app.include_router(projects.router,         prefix=PREFIX, tags=["Projects"])
app.include_router(projects_sources.router, prefix=PREFIX, tags=["Project Sources"])
app.include_router(keys.router,             prefix=PREFIX, tags=["API Keys"])
app.include_router(profile.router,          prefix=PREFIX, tags=["Profile"])
app.include_router(search.router,           prefix=PREFIX, tags=["Search"])
app.include_router(run.router,              prefix=PREFIX, tags=["Code Runner"])
app.include_router(transcribe.router,       prefix=PREFIX, tags=["Transcribe"])
app.include_router(parse_file.router,       prefix=PREFIX, tags=["File Parser"])
app.include_router(voice.router,            prefix=PREFIX, tags=["Voice"])
app.include_router(tool_chat.router,        prefix=PREFIX, tags=["Tool Chat"])
app.include_router(news.router,             prefix=PREFIX, tags=["News"])
app.include_router(guest.router,            prefix=PREFIX, tags=["Guest Auth"])
app.include_router(admin.router,            prefix=PREFIX, tags=["Admin"])
app.include_router(prompts.router,          prefix=PREFIX, tags=["Prompts"])
app.include_router(agent_memory.router,     prefix=PREFIX, tags=["Agent Memory"])
app.include_router(schedules.router,        prefix=PREFIX, tags=["Schedules"])
app.include_router(chat_tools.router,       prefix=PREFIX, tags=["Chat Tools (MCP)"])
app.include_router(terminal.router,                         tags=["Terminal"])  # WebSocket, no /api prefix

# ── v1 API routes (/api/v1/*) — enterprise endpoints ─────────────────
# Routers are created lazily; import only if the module exists
try:
    from routers.v1 import router as v1_router
    app.include_router(v1_router, prefix="/api/v1", tags=["v1"])
    logger.debug("v1 router mounted at /api/v1")
except ImportError:
    pass  # v1 routers not yet created


# ── Health check ──────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health(request: Request):
    db_ok = False
    redis_ok = False

    if settings.database_url:
        try:
            from db.engine import async_engine
            from sqlalchemy import text
            async with async_engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            db_ok = True
        except Exception:  # noqa: BLE001
            pass

    try:
        from core.redis import get_redis
        r = await get_redis()
        await r.ping()
        redis_ok = True
    except Exception:  # noqa: BLE001
        pass

    return {
        "status": "ok",
        "request_id": getattr(request.state, "request_id", None),
        "service": "Pyxis One — Python Backend",
        "environment": settings.environment,
        "infrastructure": {
            "database": "ok" if db_ok else "unavailable",
            "redis":    "ok" if redis_ok else "unavailable",
        },
        "providers": {
            "gemini":      bool(settings.gemini_api_key),
            "openrouter":  bool(settings.openrouter_api_key),
            "openai":      bool(settings.openai_api_key),
            "huggingface": bool(settings.huggingface_api_key),
        },
    }


# ── SPA fallback ──────────────────────────────────────────────────────
@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    """Serve React SPA for all non-API routes (production build only)."""
    if DIST_DIR.exists():
        index = DIST_DIR / "index.html"
        if index.exists():
            return FileResponse(index)
    return {"detail": "React frontend not built. Run: cd frontend && npm run build"}
