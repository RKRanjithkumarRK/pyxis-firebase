"""
API Keys router — store/delete user-provided keys in Firestore private subcollection.
GET returns only which providers are configured, NEVER the actual key values.
"""

from fastapi import APIRouter, Depends, HTTPException
from google.cloud.firestore_v1.transforms import DELETE_FIELD

from core.auth import verify_token
from core.firebase import get_firestore
from schemas.models import KeyDeleteRequest, KeySave

router = APIRouter()

ALLOWED_PROVIDERS = {"openrouter", "openai", "huggingface", "gemini"}

KEY_PREFIXES: dict[str, str] = {
    "openrouter": "sk-or-",
    "openai": "sk-",
    "huggingface": "hf_",
    "gemini": "AIza",
}


def _ref(uid: str):
    return get_firestore().document(f"users/{uid}/private/apikeys")


@router.get("/keys")
async def get_configured_keys(user: dict = Depends(verify_token)):
    doc = _ref(user["uid"]).get()
    data = doc.to_dict() or {} if doc.exists else {}
    return {p: bool(data.get(p)) for p in ALLOWED_PROVIDERS}


@router.post("/keys")
async def save_key(req: KeySave, user: dict = Depends(verify_token)):
    if req.provider not in ALLOWED_PROVIDERS:
        raise HTTPException(400, f"Unknown provider: {req.provider}")
    prefix = KEY_PREFIXES.get(req.provider, "")
    if prefix and not req.key.startswith(prefix):
        raise HTTPException(400, f"Invalid {req.provider} key. Expected prefix: {prefix}")
    _ref(user["uid"]).set({req.provider: req.key}, merge=True)
    return {"success": True}


@router.delete("/keys")
async def delete_key(req: KeyDeleteRequest, user: dict = Depends(verify_token)):
    if req.provider not in ALLOWED_PROVIDERS:
        raise HTTPException(400, f"Unknown provider: {req.provider}")
    _ref(user["uid"]).update({req.provider: DELETE_FIELD})
    return {"success": True}
