"""
Pyxis One - ABAC enforcement layer (Casbin + Postgres adapter).

Usage:
    from core.abac import require_permission, AbacContext, get_abac_context

    @router.get("/sessions")
    async def list_sessions(
        _: AbacContext = Depends(require_permission("sessions", "read")),
    ):
        ...
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import casbin
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import verify_token
from db.engine import get_db

logger = logging.getLogger(__name__)

_MODEL_PATH = str(Path(__file__).parent / "abac_model.conf")

_enforcer = None


def _get_sync_db_url() -> str:
    from core.config import get_settings
    url = get_settings().database_url
    if not url:
        return "sqlite:///./pyxis_casbin.db"
    return (
        url.replace("postgresql+asyncpg://", "postgresql://")
           .replace("postgres+asyncpg://", "postgresql://")
    )


def get_enforcer():
    global _enforcer
    if _enforcer is None:
        try:
            import casbin_sqlalchemy_adapter
            sync_url = _get_sync_db_url()
            adapter = casbin_sqlalchemy_adapter.Adapter(sync_url)
            _enforcer = casbin.Enforcer(_MODEL_PATH, adapter)
            _enforcer.load_policy()
            logger.info("Casbin enforcer initialised")
        except Exception as exc:
            logger.warning("Casbin enforcer init failed: %s - falling back to allow-all", exc)
            _enforcer = _PermissiveEnforcer()
    return _enforcer


class _PermissiveEnforcer:
    def enforce(self, *_: Any) -> bool:
        return True
    def add_policy(self, *_: Any) -> bool:
        return True
    def add_role_for_user_in_domain(self, *_: Any) -> bool:
        return True
    def delete_role_for_user_in_domain(self, *_: Any) -> bool:
        return True
    def load_policy(self) -> None:
        pass


@dataclass
class AbacContext:
    user_id: str
    email: str = ""
    role: str = "user"
    plan: str = "free"
    org_id: str = ""
    workspace_id: str = ""
    extra: dict = field(default_factory=dict)

    @property
    def domain(self) -> str:
        return self.org_id or "global"


async def get_abac_context(
    token_data: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
) -> AbacContext:
    uid = token_data.get("uid", "")
    email = token_data.get("email", "")
    role = token_data.get("role", "user")
    plan = "free"
    org_id = ""

    try:
        from sqlalchemy import select
        from db.models.user import User
        from db.models.entitlement import Entitlement, Plan

        result = await db.execute(select(User).where(User.firebase_uid == uid))
        user_row = result.scalar_one_or_none()
        if user_row:
            role = user_row.role
            ent_result = await db.execute(
                select(Entitlement).where(
                    Entitlement.entity_type == "user",
                    Entitlement.entity_id == str(user_row.id),
                )
            )
            ent = ent_result.scalar_one_or_none()
            if ent and ent.plan_id:
                plan_result = await db.execute(select(Plan).where(Plan.id == ent.plan_id))
                plan_row = plan_result.scalar_one_or_none()
                if plan_row:
                    plan = plan_row.name
            if user_row.memberships:
                org_id = str(user_row.memberships[0].org_id)
    except Exception as exc:
        logger.debug("get_abac_context DB lookup failed: %s", exc)

    return AbacContext(user_id=uid, email=email, role=role, plan=plan, org_id=org_id)


def require_permission(resource: str, action: str):
    async def _check(ctx: AbacContext = Depends(get_abac_context)) -> AbacContext:
        if ctx.role == "admin":
            return ctx
        enforcer = get_enforcer()
        allowed = enforcer.enforce(ctx.user_id, ctx.domain, resource, action)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {resource}:{action}",
            )
        return ctx
    return _check


def add_policy(subject: str, domain: str, resource: str, action: str, effect: str = "allow") -> bool:
    return get_enforcer().add_policy(subject, domain, resource, action, effect)


def add_role_for_user_in_domain(user_id: str, role: str, domain: str) -> bool:
    return get_enforcer().add_role_for_user_in_domain(user_id, role, domain)


def remove_role_for_user_in_domain(user_id: str, role: str, domain: str) -> bool:
    try:
        return get_enforcer().delete_role_for_user_in_domain(user_id, role, domain)
    except Exception:
        return False


_SEED_POLICIES = [
    ("owner",  "global", "*",           "admin",  "allow"),
    ("admin",  "global", "*",           "write",  "allow"),
    ("admin",  "global", "*",           "read",   "allow"),
    ("member", "global", "sessions",    "read",   "allow"),
    ("member", "global", "sessions",    "write",  "allow"),
    ("member", "global", "mcp_servers", "read",   "allow"),
    ("viewer", "global", "sessions",    "read",   "allow"),
    ("viewer", "global", "mcp_servers", "read",   "allow"),
]


def seed_default_policies() -> None:
    enforcer = get_enforcer()
    for rule in _SEED_POLICIES:
        try:
            enforcer.add_policy(*rule)
        except Exception:
            pass
    logger.info("Casbin default policies seeded.")
