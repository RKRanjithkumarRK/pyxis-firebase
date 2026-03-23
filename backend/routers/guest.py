"""
Guest router — creates a temporary Firebase custom token for guest users.
No authentication required (this IS the auth entry point for guests).
"""

import logging
import uuid

from fastapi import APIRouter, HTTPException
from firebase_admin import auth

from core.firebase import get_auth
from schemas.models import GuestResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/guest", response_model=GuestResponse)
async def create_guest_session():
    """
    Create a temporary guest session.
    Returns a custom Firebase token the client uses with signInWithCustomToken().
    """
    try:
        firebase_auth = get_auth()
        uid = f"guest_{uuid.uuid4().hex[:16]}"

        # Custom token with guest claim
        token = firebase_auth.create_custom_token(uid, {"guest": True})

        return GuestResponse(token=token.decode() if isinstance(token, bytes) else token, uid=uid)

    except Exception as e:
        logger.error(f"Guest token creation failed: {e}")
        raise HTTPException(status_code=500, detail="Could not create guest session")
