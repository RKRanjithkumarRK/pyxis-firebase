"""v1 Sessions router — /api/v1/sessions/*"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.abac import AbacContext, require_permission
from db.engine import get_db
from db.models.session import MultimodalSession, SessionEvent

router = APIRouter(prefix="/sessions", tags=["v1 Sessions"])


# ── Schemas ───────────────────────────────────────────────────────────
class SessionOut(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: str
    title: str
    modality: str
    status: str
    model_profile: str
    persona_slug: str | None
    created_at: str


class SessionCreateIn(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    title: str = "New Session"
    modality: str = "chat"
    model_profile: str = "daily"
    persona_slug: str | None = None
    meta: dict[str, Any] = {}


class SessionUpdateIn(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    title: str | None = None
    status: str | None = None
    model_profile: str | None = None
    persona_slug: str | None = None


class EventOut(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: str
    role: str
    content_type: str
    content: str
    sequence: int
    model_id: str | None
    created_at: str


# ── Endpoints ─────────────────────────────────────────────────────────
@router.get("", response_model=list[SessionOut])
async def list_sessions(
    ctx: AbacContext = Depends(require_permission("sessions", "read")),
    db: AsyncSession = Depends(get_db),
):
    """List sessions for the current user."""
    from services.user_sync import get_user_by_firebase_uid
    user = await get_user_by_firebase_uid(db, ctx.user_id)
    if not user:
        return []

    result = await db.execute(
        select(MultimodalSession)
        .where(MultimodalSession.user_id == user.id, MultimodalSession.status != "deleted")
        .order_by(MultimodalSession.created_at.desc())
        .limit(50)
    )
    sessions = result.scalars().all()
    return [
        SessionOut(
            id=str(s.id), title=s.title, modality=s.modality, status=s.status,
            model_profile=s.model_profile, persona_slug=s.persona_slug,
            created_at=s.created_at.isoformat(),
        )
        for s in sessions
    ]


@router.post("", response_model=SessionOut, status_code=201)
async def create_session(
    body: SessionCreateIn,
    ctx: AbacContext = Depends(require_permission("sessions", "write")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new multimodal session."""
    from services.user_sync import upsert_user
    user = await upsert_user(db, firebase_uid=ctx.user_id, email=ctx.email)

    session = MultimodalSession(
        id=uuid.uuid4(),
        user_id=user.id,
        title=body.title,
        modality=body.modality,
        model_profile=body.model_profile,
        persona_slug=body.persona_slug,
        meta=body.meta,
    )
    db.add(session)
    await db.flush()
    return SessionOut(
        id=str(session.id), title=session.title, modality=session.modality,
        status=session.status, model_profile=session.model_profile,
        persona_slug=session.persona_slug, created_at=session.created_at.isoformat(),
    )


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(
    session_id: str,
    ctx: AbacContext = Depends(require_permission("sessions", "read")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MultimodalSession).where(MultimodalSession.id == uuid.UUID(session_id))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionOut(
        id=str(session.id), title=session.title, modality=session.modality,
        status=session.status, model_profile=session.model_profile,
        persona_slug=session.persona_slug, created_at=session.created_at.isoformat(),
    )


@router.patch("/{session_id}", response_model=SessionOut)
async def update_session(
    session_id: str,
    body: SessionUpdateIn,
    ctx: AbacContext = Depends(require_permission("sessions", "write")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MultimodalSession).where(MultimodalSession.id == uuid.UUID(session_id))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if body.title is not None:
        session.title = body.title
    if body.status is not None:
        session.status = body.status
    if body.model_profile is not None:
        session.model_profile = body.model_profile
    if body.persona_slug is not None:
        session.persona_slug = body.persona_slug

    await db.flush()
    return SessionOut(
        id=str(session.id), title=session.title, modality=session.modality,
        status=session.status, model_profile=session.model_profile,
        persona_slug=session.persona_slug, created_at=session.created_at.isoformat(),
    )


@router.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: str,
    ctx: AbacContext = Depends(require_permission("sessions", "write")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MultimodalSession).where(MultimodalSession.id == uuid.UUID(session_id))
    )
    session = result.scalar_one_or_none()
    if session:
        session.status = "deleted"
        await db.flush()


@router.get("/{session_id}/events", response_model=list[EventOut])
async def list_events(
    session_id: str,
    ctx: AbacContext = Depends(require_permission("sessions", "read")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SessionEvent)
        .where(SessionEvent.session_id == uuid.UUID(session_id))
        .order_by(SessionEvent.sequence.asc())
    )
    events = result.scalars().all()
    return [
        EventOut(
            id=str(e.id), role=e.role, content_type=e.content_type,
            content=e.content, sequence=e.sequence, model_id=e.model_id,
            created_at=e.created_at.isoformat(),
        )
        for e in events
    ]
