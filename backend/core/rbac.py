"""
Role-Based Access Control — dependency factories for FastAPI routes.
Roles: admin > user > guest
"""
import logging
from fastapi import Depends, HTTPException, status
from .auth import verify_token
from .firebase import get_firestore, get_auth

logger = logging.getLogger(__name__)

ROLE_HIERARCHY = {"admin": 3, "user": 2, "guest": 1}

def _role_level(role: str) -> int:
    return ROLE_HIERARCHY.get(role, 1)

async def _get_user_role(uid: str) -> str:
    """Read role from Firestore meta doc (fallback: 'user')."""
    try:
        db = get_firestore()
        doc = db.document(f"users/{uid}/private/meta").get()
        if doc.exists:
            return doc.to_dict().get("role", "user")
    except Exception:
        pass
    return "user"

async def require_user(user: dict = Depends(verify_token)) -> dict:
    """Allow any authenticated user (role >= user). Guests blocked."""
    role = user.get("role") or await _get_user_role(user["uid"])
    if _role_level(role) < _role_level("user"):
        raise HTTPException(status_code=403, detail="User account required")
    user["_role"] = role
    return user

async def require_admin(user: dict = Depends(verify_token)) -> dict:
    """Allow only admin role."""
    role = user.get("role") or await _get_user_role(user["uid"])
    if _role_level(role) < _role_level("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    user["_role"] = role
    return user

async def require_any(user: dict = Depends(verify_token)) -> dict:
    """Allow any authenticated user including guests."""
    role = user.get("role") or await _get_user_role(user["uid"])
    user["_role"] = role
    return user

async def set_user_role(uid: str, role: str) -> None:
    """Set user role in Firestore and Firebase custom claims."""
    if role not in ROLE_HIERARCHY:
        raise ValueError(f"Invalid role: {role}")
    db = get_firestore()
    from google.cloud.firestore_v1.transforms import SERVER_TIMESTAMP
    db.document(f"users/{uid}/private/meta").set(
        {"role": role, "updatedAt": SERVER_TIMESTAMP}, merge=True
    )
    try:
        auth = get_auth()
        auth.set_custom_user_claims(uid, {"role": role})
    except Exception as e:
        logger.warning(f"Could not set custom claims for {uid}: {e}")
