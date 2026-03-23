"""
Messages router — CRUD for messages inside a conversation.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from google.cloud.firestore_v1.transforms import SERVER_TIMESTAMP

from core.auth import verify_token
from core.firebase import get_firestore
from schemas.models import MessageCreate, MessageResponse

logger = logging.getLogger(__name__)
router = APIRouter()


def _own_conv(db, conv_id: str, uid: str):
    """Return conv ref if it exists and belongs to uid, else raise 404."""
    ref = db.collection("conversations").document(conv_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("userId") != uid:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return ref


@router.get("/messages", response_model=list[MessageResponse])
async def get_messages(
    conversationId: str = Query(...),
    user: dict = Depends(verify_token),
):
    db = get_firestore()
    conv_ref = _own_conv(db, conversationId, user["uid"])
    docs = conv_ref.collection("messages").order_by("createdAt").stream()
    return [
        MessageResponse(
            id=doc.id,
            role=doc.to_dict().get("role", ""),
            content=doc.to_dict().get("content", ""),
            imageUrl=doc.to_dict().get("imageUrl"),
            createdAt=doc.to_dict().get("createdAt"),
        )
        for doc in docs
    ]


@router.post("/messages", response_model=MessageResponse)
async def add_message(req: MessageCreate, user: dict = Depends(verify_token)):
    db = get_firestore()
    conv_ref = _own_conv(db, req.conversationId, user["uid"])

    msg_data: dict = {
        "role": req.role,
        "content": req.content,
        "createdAt": SERVER_TIMESTAMP,
    }
    if req.imageUrl:
        msg_data["imageUrl"] = req.imageUrl

    _, msg_ref = conv_ref.collection("messages").add(msg_data)

    # Auto-title: set title from first user message if still default
    if req.role == "user":
        conv_data = conv_ref.get().to_dict() or {}
        if conv_data.get("title") in ("New Conversation", "", None):
            title = req.content[:60] + ("..." if len(req.content) > 60 else "")
            conv_ref.update({"title": title, "updatedAt": SERVER_TIMESTAMP})
        else:
            conv_ref.update({"updatedAt": SERVER_TIMESTAMP})

    return MessageResponse(
        id=msg_ref.id,
        role=req.role,
        content=req.content,
        imageUrl=req.imageUrl,
    )


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    conversationId: str = Query(...),
    user: dict = Depends(verify_token),
):
    db = get_firestore()
    conv_ref = _own_conv(db, conversationId, user["uid"])
    conv_ref.collection("messages").document(message_id).delete()
    return {"success": True}
