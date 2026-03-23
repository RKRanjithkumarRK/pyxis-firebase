"""
User sync service — ensures every Firebase-authenticated user has a Postgres row.

Called on first authenticated request (upsert pattern).
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.user import User

logger = logging.getLogger(__name__)


async def upsert_user(
    db: AsyncSession,
    firebase_uid: str,
    email: str,
    display_name: str = "",
    avatar_url: str | None = None,
) -> User:
    """
    Get-or-create a User row from Firebase identity data.
    Updates display_name and avatar_url if they changed.
    """
    result = await db.execute(select(User).where(User.firebase_uid == firebase_uid))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            id=uuid.uuid4(),
            firebase_uid=firebase_uid,
            email=email,
            display_name=display_name or email.split("@")[0],
            avatar_url=avatar_url,
            role="user",
        )
        db.add(user)
        logger.info("Created new user row for firebase_uid=%s", firebase_uid)
    else:
        # Keep display name + avatar fresh
        changed = False
        if display_name and user.display_name != display_name:
            user.display_name = display_name
            changed = True
        if avatar_url and user.avatar_url != avatar_url:
            user.avatar_url = avatar_url
            changed = True
        if changed:
            logger.debug("Updated user profile for firebase_uid=%s", firebase_uid)

    await db.flush()  # assign id without committing — caller's session commits
    return user


async def get_user_by_firebase_uid(db: AsyncSession, firebase_uid: str) -> User | None:
    result = await db.execute(select(User).where(User.firebase_uid == firebase_uid))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
