"""
Profile router — user settings and personalization.
"""

from fastapi import APIRouter, Depends, Query
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

from core.auth import verify_token
from core.firebase import get_firestore
from schemas.models import ProfileUpdate

router = APIRouter()


@router.get("/profile")
async def get_profile(
    section: str = Query(default="general"),
    user: dict = Depends(verify_token),
):
    db = get_firestore()
    ref = db.document(f"users/{user['uid']}/settings/{section}")
    doc = ref.get()
    return doc.to_dict() or {} if doc.exists else {}


@router.post("/profile")
async def save_profile(req: ProfileUpdate, user: dict = Depends(verify_token)):
    db = get_firestore()
    ref = db.document(f"users/{user['uid']}/settings/{req.section}")
    ref.set({**req.data, "updatedAt": SERVER_TIMESTAMP}, merge=True)
    return {"success": True}
