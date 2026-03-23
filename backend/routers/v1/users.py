"""v1 Users router — /api/v1/users/*"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.abac import AbacContext, get_abac_context
from db.engine import get_db
from services.user_sync import get_user_by_firebase_uid, upsert_user

router = APIRouter(prefix="/users", tags=["v1 Users"])


class UserOut(BaseModel):
    id: str
    firebase_uid: str
    email: str
    display_name: str
    avatar_url: str | None
    role: str

    class Config:
        from_attributes = True


class UserUpdateIn(BaseModel):
    display_name: str | None = None
    avatar_url: str | None = None


@router.get("/me", response_model=UserOut)
async def get_me(
    ctx: AbacContext = Depends(get_abac_context),
    db: AsyncSession = Depends(get_db),
):
    """Return current user profile, creating the DB row if first login."""
    user = await upsert_user(
        db,
        firebase_uid=ctx.user_id,
        email=ctx.email,
    )
    return UserOut(
        id=str(user.id),
        firebase_uid=user.firebase_uid,
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        role=user.role,
    )


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UserUpdateIn,
    ctx: AbacContext = Depends(get_abac_context),
    db: AsyncSession = Depends(get_db),
):
    """Update current user's display name or avatar."""
    user = await get_user_by_firebase_uid(db, ctx.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if body.display_name is not None:
        user.display_name = body.display_name
    if body.avatar_url is not None:
        user.avatar_url = body.avatar_url

    await db.flush()
    return UserOut(
        id=str(user.id),
        firebase_uid=user.firebase_uid,
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        role=user.role,
    )
