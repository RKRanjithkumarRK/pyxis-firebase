"""v1 Organizations router — /api/v1/orgs/*"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.abac import AbacContext, get_abac_context, add_role_for_user_in_domain
from db.engine import get_db
from db.models.organization import Organization, Workspace, Membership
from services.user_sync import get_user_by_firebase_uid

router = APIRouter(prefix="/orgs", tags=["v1 Organizations"])


# ── Schemas ───────────────────────────────────────────────────────────
class OrgOut(BaseModel):
    id: str
    name: str
    slug: str
    owner_id: str


class OrgCreateIn(BaseModel):
    name: str
    slug: str


class WorkspaceOut(BaseModel):
    id: str
    org_id: str
    name: str
    slug: str


class WorkspaceCreateIn(BaseModel):
    name: str
    slug: str


# ── Org endpoints ─────────────────────────────────────────────────────
@router.get("", response_model=list[OrgOut])
async def list_orgs(
    ctx: AbacContext = Depends(get_abac_context),
    db: AsyncSession = Depends(get_db),
):
    """List orgs the current user belongs to."""
    user = await get_user_by_firebase_uid(db, ctx.user_id)
    if not user:
        return []

    result = await db.execute(
        select(Organization)
        .join(Membership, Membership.org_id == Organization.id)
        .where(Membership.user_id == user.id)
    )
    orgs = result.scalars().all()
    return [OrgOut(id=str(o.id), name=o.name, slug=o.slug, owner_id=str(o.owner_id)) for o in orgs]


@router.post("", response_model=OrgOut, status_code=status.HTTP_201_CREATED)
async def create_org(
    body: OrgCreateIn,
    ctx: AbacContext = Depends(get_abac_context),
    db: AsyncSession = Depends(get_db),
):
    """Create a new organization (caller becomes owner)."""
    user = await get_user_by_firebase_uid(db, ctx.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found — call /api/v1/users/me first")

    # Check slug uniqueness
    existing = await db.execute(select(Organization).where(Organization.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Org slug already taken")

    org = Organization(id=uuid.uuid4(), name=body.name, slug=body.slug, owner_id=user.id)
    db.add(org)
    await db.flush()

    # Add owner membership
    membership = Membership(
        id=uuid.uuid4(),
        user_id=user.id,
        org_id=org.id,
        role="owner",
    )
    db.add(membership)
    await db.flush()

    # Grant Casbin owner role in org domain
    add_role_for_user_in_domain(ctx.user_id, "owner", str(org.id))

    return OrgOut(id=str(org.id), name=org.name, slug=org.slug, owner_id=str(org.owner_id))


@router.get("/{org_id}", response_model=OrgOut)
async def get_org(
    org_id: str,
    ctx: AbacContext = Depends(get_abac_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == uuid.UUID(org_id)))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return OrgOut(id=str(org.id), name=org.name, slug=org.slug, owner_id=str(org.owner_id))


# ── Workspace endpoints ───────────────────────────────────────────────
@router.get("/{org_id}/workspaces", response_model=list[WorkspaceOut])
async def list_workspaces(
    org_id: str,
    ctx: AbacContext = Depends(get_abac_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Workspace).where(Workspace.org_id == uuid.UUID(org_id))
    )
    workspaces = result.scalars().all()
    return [
        WorkspaceOut(id=str(w.id), org_id=str(w.org_id), name=w.name, slug=w.slug)
        for w in workspaces
    ]


@router.post("/{org_id}/workspaces", response_model=WorkspaceOut, status_code=201)
async def create_workspace(
    org_id: str,
    body: WorkspaceCreateIn,
    ctx: AbacContext = Depends(get_abac_context),
    db: AsyncSession = Depends(get_db),
):
    ws = Workspace(
        id=uuid.uuid4(),
        org_id=uuid.UUID(org_id),
        name=body.name,
        slug=body.slug,
    )
    db.add(ws)
    await db.flush()
    return WorkspaceOut(id=str(ws.id), org_id=str(ws.org_id), name=ws.name, slug=ws.slug)
