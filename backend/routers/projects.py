"""
Projects router — group conversations into projects.
"""

from fastapi import APIRouter, Depends, HTTPException
from google.cloud.firestore_v1.transforms import SERVER_TIMESTAMP

from core.auth import verify_token
from core.firebase import get_firestore
from schemas.models import ProjectCreate, ProjectResponse, ProjectUpdate

router = APIRouter()


@router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(user: dict = Depends(verify_token)):
    db = get_firestore()
    # Single-field filter only — no composite index needed; sort in Python
    docs = (
        db.collection("projects")
        .where("userId", "==", user["uid"])
        .stream()
    )
    results = [ProjectResponse(id=doc.id, **_pick(doc.to_dict())) for doc in docs]
    # Sort by updatedAt descending in Python (str conversion handles Firestore timestamps)
    results.sort(key=lambda p: str(p.updatedAt) if p.updatedAt else "", reverse=True)
    return results


@router.post("/projects", response_model=ProjectResponse)
async def create_project(req: ProjectCreate, user: dict = Depends(verify_token)):
    db = get_firestore()
    _, ref = db.collection("projects").add({
        "name": req.name,
        "tags": req.tags,
        "userId": user["uid"],
        "createdAt": SERVER_TIMESTAMP,
        "updatedAt": SERVER_TIMESTAMP,
    })
    return ProjectResponse(id=ref.id, name=req.name, tags=req.tags)


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    req: ProjectUpdate,
    user: dict = Depends(verify_token),
):
    db = get_firestore()
    ref = db.collection("projects").document(project_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(404, "Project not found")

    updates: dict = {"updatedAt": SERVER_TIMESTAMP}
    if req.name is not None:
        updates["name"] = req.name
    if req.tags is not None:
        updates["tags"] = req.tags
    ref.update(updates)
    return ProjectResponse(id=project_id, **_pick(ref.get().to_dict()))


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(verify_token)):
    db = get_firestore()
    ref = db.collection("projects").document(project_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(404, "Project not found")
    ref.delete()
    return {"success": True}


def _pick(d: dict) -> dict:
    return {k: v for k, v in d.items() if k in {"name", "tags", "createdAt", "updatedAt"}}
