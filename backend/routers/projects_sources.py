"""
Project sources router — manage documents/URLs attached to a project.
"""

from fastapi import APIRouter, Depends, HTTPException
from google.cloud.firestore_v1.transforms import SERVER_TIMESTAMP
from pydantic import BaseModel

from core.auth import verify_token
from core.firebase import get_firestore

router = APIRouter()


class SourceCreate(BaseModel):
    type: str           # "url" | "text" | "file"
    content: str        # URL or text content
    name: str = ""


@router.get("/projects/{project_id}/sources")
async def list_sources(project_id: str, user: dict = Depends(verify_token)):
    db = get_firestore()
    ref = db.collection("projects").document(project_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(404, "Project not found")
    docs = ref.collection("sources").stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


@router.post("/projects/{project_id}/sources")
async def add_source(
    project_id: str,
    req: SourceCreate,
    user: dict = Depends(verify_token),
):
    db = get_firestore()
    ref = db.collection("projects").document(project_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(404, "Project not found")

    _, src_ref = ref.collection("sources").add({
        "type": req.type,
        "content": req.content,
        "name": req.name,
        "createdAt": SERVER_TIMESTAMP,
    })
    return {"id": src_ref.id, "success": True}


@router.delete("/projects/{project_id}/sources/{source_id}")
async def delete_source(
    project_id: str,
    source_id: str,
    user: dict = Depends(verify_token),
):
    db = get_firestore()
    ref = db.collection("projects").document(project_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(404, "Project not found")
    ref.collection("sources").document(source_id).delete()
    return {"success": True}
