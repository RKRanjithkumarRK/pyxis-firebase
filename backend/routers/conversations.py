"""
Conversations router — CRUD for chat conversations.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from google.cloud.firestore_v1.transforms import SERVER_TIMESTAMP

from core.auth import verify_token
from core.firebase import get_firestore
from schemas.models import ConversationCreate, ConversationUpdate, ConversationResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(user: dict = Depends(verify_token)):
    db = get_firestore()
    # No order_by — that requires a composite index. Sort in Python instead.
    docs = (
        db.collection("conversations")
        .where("userId", "==", user["uid"])
        .stream()
    )
    results = [
        ConversationResponse(id=doc.id, **_pick(doc.to_dict()))
        for doc in docs
        if not doc.to_dict().get("archived", False)
    ]
    results.sort(key=lambda c: str(c.updatedAt) if c.updatedAt else "", reverse=True)
    return results


@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(req: ConversationCreate, user: dict = Depends(verify_token)):
    db = get_firestore()
    data: dict = {
        "title": req.title,
        "model": req.model,
        "userId": user["uid"],
        "archived": False,
        "createdAt": SERVER_TIMESTAMP,
        "updatedAt": SERVER_TIMESTAMP,
    }
    if req.projectId:
        data["projectId"] = req.projectId

    _, ref = db.collection("conversations").add(data)
    return ConversationResponse(
        id=ref.id,
        title=req.title,
        model=req.model,
        archived=False,
        projectId=req.projectId,
    )


@router.patch("/conversations/{conv_id}", response_model=ConversationResponse)
async def update_conversation(
    conv_id: str,
    req: ConversationUpdate,
    user: dict = Depends(verify_token),
):
    db = get_firestore()
    ref = db.collection("conversations").document(conv_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Conversation not found")

    updates: dict = {"updatedAt": SERVER_TIMESTAMP}
    if req.title is not None:
        updates["title"] = req.title
    if req.archived is not None:
        updates["archived"] = req.archived

    ref.update(updates)
    return ConversationResponse(id=conv_id, **_pick(ref.get().to_dict()))


@router.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: str, user: dict = Depends(verify_token)):
    db = get_firestore()
    ref = db.collection("conversations").document(conv_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Batch-delete all child messages first
    for msg in ref.collection("messages").stream():
        msg.reference.delete()

    ref.delete()
    return {"success": True}


def _pick(data: dict) -> dict:
    keys = {"title", "model", "createdAt", "updatedAt", "archived", "projectId"}
    return {k: v for k, v in data.items() if k in keys}
