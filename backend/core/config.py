from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Firebase Admin (server-side) ──────────────────────────────────
    firebase_project_id:   str = ""
    firebase_client_email: str = ""
    firebase_private_key:  str = ""

    # ── Firebase Client (browser-side, injected into HTML templates) ──
    firebase_api_key:             str = ""
    firebase_auth_domain:         str = ""
    firebase_storage_bucket:      str = ""
    firebase_messaging_sender_id: str = ""
    firebase_app_id:              str = ""

    # ── AI Providers ─────────────────────────────────────────────────
    gemini_api_key:      str = ""   # Primary Gemini key (legacy single-key support)
    gemini_api_keys:     str = ""   # Comma-separated list for multi-key rotation
    openrouter_api_key:  str = ""
    openai_api_key:      str = ""
    anthropic_api_key:   str = ""
    huggingface_api_key: str = ""
    judge0_api_key:      str = ""   # RapidAPI key for Judge0 CE (non-Python execution)

    # ── Fast Free Providers (add keys for zero rate-limit downtime) ───
    groq_api_key:        str = ""   # Free at console.groq.com — 14,400 RPD, very fast
    cerebras_api_key:    str = ""   # Free at cloud.cerebras.ai — 2000+ tok/s
    sambanova_api_key:   str = ""   # Free at cloud.sambanova.ai — wafer-scale inference

    @property
    def gemini_keys_list(self) -> list[str]:
        """Return all configured Gemini API keys for round-robin rotation."""
        keys: list[str] = []
        if self.gemini_api_keys:
            keys.extend(k.strip() for k in self.gemini_api_keys.split(",") if k.strip())
        if self.gemini_api_key and self.gemini_api_key not in keys:
            keys.append(self.gemini_api_key)
        return keys

    # ── Database (Postgres preferred; SQLite fallback for local dev) ──
    database_url: str = ""           # postgresql+asyncpg://user:pass@host/db
    database_pool_size: int = 20
    database_max_overflow: int = 10

    # ── Cache + Message Broker (Redis) ────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"
    redis_max_connections: int = 20

    # ── Celery ────────────────────────────────────────────────────────
    celery_broker_url: str = ""      # defaults to redis_url at runtime
    celery_result_backend: str = ""  # defaults to redis_url at runtime

    # ── Notifications ─────────────────────────────────────────────────
    sendgrid_api_key:      str = ""
    sendgrid_from_email:   str = "noreply@pyxis.ai"
    slack_webhook_url:     str = ""

    # ── Security ──────────────────────────────────────────────────────
    secret_key: str = "change-me-in-production"   # JWT / session signing

    # ── App ───────────────────────────────────────────────────────────
    allowed_origins: str = "http://localhost:8000,http://localhost:3000"
    environment: str = "development"   # development | staging | production

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def effective_celery_broker(self) -> str:
        return self.celery_broker_url or self.redis_url

    @property
    def effective_celery_backend(self) -> str:
        return self.celery_result_backend or self.redis_url

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
