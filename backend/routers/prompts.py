"""
Prompt Library — CRUD for saved prompts. Supports personal, workspace, and public scopes.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from google.cloud.firestore_v1.transforms import SERVER_TIMESTAMP
from core.auth import verify_token
from core.firebase import get_firestore
from schemas.models import PromptCreate, PromptResponse

logger = logging.getLogger(__name__)
router = APIRouter()

def _check_owner(doc_data: dict, uid: str):
    if doc_data.get("userId") != uid:
        raise HTTPException(403, "Not your prompt")

@router.get("/prompts", response_model=list[PromptResponse])
async def list_prompts(user: dict = Depends(verify_token)):
    db = get_firestore()
    uid = user["uid"]
    results = []
    # Personal prompts
    try:
        for doc in db.collection("prompts").where("userId", "==", uid).stream():
            d = doc.to_dict()
            if not d.get("deleted"):
                results.append(PromptResponse(id=doc.id, **_pick_prompt(d)))
    except Exception as e:
        logger.warning(f"Prompt list error: {e}")
    # Public/community prompts
    try:
        for doc in db.collection("prompts").where("scope", "==", "public").limit(50).stream():
            d = doc.to_dict()
            if not d.get("deleted") and d.get("userId") != uid:
                results.append(PromptResponse(id=doc.id, **_pick_prompt(d)))
    except Exception:
        pass
    return results

@router.post("/prompts", response_model=PromptResponse)
async def create_prompt(req: PromptCreate, user: dict = Depends(verify_token)):
    db = get_firestore()
    data = {
        "userId": user["uid"],
        "title": req.title,
        "content": req.content,
        "description": req.description or "",
        "tags": req.tags or [],
        "scope": req.scope or "personal",
        "category": req.category or "general",
        "deleted": False,
        "usageCount": 0,
        "createdAt": SERVER_TIMESTAMP,
        "updatedAt": SERVER_TIMESTAMP,
    }
    _, ref = db.collection("prompts").add(data)
    return PromptResponse(
        id=ref.id, title=req.title, content=req.content,
        description=req.description or "", tags=req.tags or [],
        scope=req.scope or "personal", category=req.category or "general",
        userId=user["uid"], usageCount=0,
    )

@router.patch("/prompts/{pid}", response_model=PromptResponse)
async def update_prompt(pid: str, req: dict, user: dict = Depends(verify_token)):
    db = get_firestore()
    ref = db.collection("prompts").document(pid)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Prompt not found")
    _check_owner(doc.to_dict(), user["uid"])
    allowed = {"title", "content", "description", "tags", "scope", "category"}
    updates = {k: v for k, v in req.items() if k in allowed}
    updates["updatedAt"] = SERVER_TIMESTAMP
    ref.update(updates)
    return PromptResponse(id=pid, **_pick_prompt(ref.get().to_dict()))

@router.delete("/prompts/{pid}")
async def delete_prompt(pid: str, user: dict = Depends(verify_token)):
    db = get_firestore()
    ref = db.collection("prompts").document(pid)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Prompt not found")
    _check_owner(doc.to_dict(), user["uid"])
    ref.update({"deleted": True, "updatedAt": SERVER_TIMESTAMP})
    return {"success": True}

@router.post("/prompts/{pid}/use")
async def increment_usage(pid: str, user: dict = Depends(verify_token)):
    """Increment usage counter when a prompt is used."""
    db = get_firestore()
    from google.cloud.firestore_v1 import Increment
    db.collection("prompts").document(pid).update({"usageCount": Increment(1)})
    return {"success": True}

def _pick_prompt(d: dict) -> dict:
    return {
        "title": d.get("title", ""),
        "content": d.get("content", ""),
        "description": d.get("description", ""),
        "tags": d.get("tags", []),
        "scope": d.get("scope", "personal"),
        "category": d.get("category", "general"),
        "userId": d.get("userId", ""),
        "usageCount": d.get("usageCount", 0),
        "createdAt": d.get("createdAt"),
        "updatedAt": d.get("updatedAt"),
    }
