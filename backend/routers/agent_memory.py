"""
Persistent agent memory — stores facts the agent has learned about the user.
"""
from fastapi import APIRouter, Depends, HTTPException
from google.cloud.firestore_v1.transforms import SERVER_TIMESTAMP
from core.auth import verify_token
from core.firebase import get_firestore

router = APIRouter()

@router.get("/agents/{agent_id}/memory")
async def get_memory(agent_id: str, user: dict = Depends(verify_token)):
    db = get_firestore()
    doc = db.document(f"users/{user['uid']}/agent_memory/{agent_id}").get()
    if doc.exists:
        return doc.to_dict()
    return {"facts": [], "summary": ""}

@router.post("/agents/{agent_id}/memory")
async def update_memory(agent_id: str, body: dict, user: dict = Depends(verify_token)):
    db = get_firestore()
    ref = db.document(f"users/{user['uid']}/agent_memory/{agent_id}")
    facts = body.get("facts", [])
    summary = body.get("summary", "")
    ref.set({"facts": facts, "summary": summary, "updatedAt": SERVER_TIMESTAMP}, merge=True)
    return {"success": True}

@router.delete("/agents/{agent_id}/memory")
async def clear_memory(agent_id: str, user: dict = Depends(verify_token)):
    db = get_firestore()
    db.document(f"users/{user['uid']}/agent_memory/{agent_id}").delete()
    return {"success": True}
