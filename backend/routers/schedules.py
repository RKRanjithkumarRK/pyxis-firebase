"""
Scheduled AI Tasks — run prompts on a cron schedule.
Unique enterprise feature: no competitor (ChatGPT/Gemini/Claude) has this.
Schedules are stored in Firestore and executed by the background runner.
"""
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from google.cloud.firestore_v1.transforms import SERVER_TIMESTAMP
from pydantic import BaseModel

from core.auth import verify_token
from core.firebase import get_firestore

logger = logging.getLogger(__name__)
router = APIRouter()


class ScheduleCreate(BaseModel):
    name: str
    prompt: str
    model: str = "gemini-2.5-flash"
    cronLabel: str = "daily"   # "hourly" | "daily" | "weekly" | "monthly"
    enabled: bool = True
    systemPrompt: str | None = None


class ScheduleUpdate(BaseModel):
    name: str | None = None
    prompt: str | None = None
    model: str | None = None
    cronLabel: str | None = None
    enabled: bool | None = None
    systemPrompt: str | None = None


@router.get("/schedules")
async def list_schedules(user: dict = Depends(verify_token)):
    db = get_firestore()
    try:
        docs = (
            db.collection("schedules")
            .where("userId", "==", user["uid"])
            .stream()
        )
        results = [{"id": d.id, **_safe(d.to_dict())} for d in docs]
        results.sort(key=lambda s: str(s.get("createdAt") or ""), reverse=True)
        return results
    except Exception as e:
        logger.error(f"List schedules error: {e}")
        return []


@router.post("/schedules")
async def create_schedule(body: ScheduleCreate, user: dict = Depends(verify_token)):
    db = get_firestore()
    doc = {
        "userId":       user["uid"],
        "name":         body.name,
        "prompt":       body.prompt,
        "model":        body.model,
        "cronLabel":    body.cronLabel,
        "enabled":      body.enabled,
        "systemPrompt": body.systemPrompt,
        "runCount":     0,
        "lastRunAt":    None,
        "lastResult":   None,
        "createdAt":    SERVER_TIMESTAMP,
        "updatedAt":    SERVER_TIMESTAMP,
    }
    _, ref = db.collection("schedules").add(doc)
    return {
        "id": ref.id,
        "name": body.name,
        "prompt": body.prompt,
        "model": body.model,
        "cronLabel": body.cronLabel,
        "enabled": body.enabled,
        "systemPrompt": body.systemPrompt,
        "runCount": 0,
        "lastRunAt": None,
        "lastResult": None,
    }


@router.patch("/schedules/{schedule_id}")
async def update_schedule(
    schedule_id: str,
    body: ScheduleUpdate,
    user: dict = Depends(verify_token),
):
    db = get_firestore()
    ref = db.collection("schedules").document(schedule_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(404, "Schedule not found")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updatedAt"] = SERVER_TIMESTAMP
    ref.update(updates)
    return {"success": True}


@router.delete("/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str, user: dict = Depends(verify_token)):
    db = get_firestore()
    ref = db.collection("schedules").document(schedule_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(404, "Schedule not found")
    ref.delete()
    return {"success": True}


@router.post("/schedules/{schedule_id}/run-now")
async def run_schedule_now(schedule_id: str, user: dict = Depends(verify_token)):
    """Trigger a schedule immediately (test run)."""
    import asyncio
    from core.config import get_settings
    from services import gemini

    db = get_firestore()
    ref = db.collection("schedules").document(schedule_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(404, "Schedule not found")

    data = doc.to_dict()
    settings = get_settings()

    # Get user keys
    try:
        keys_doc = db.document(f"users/{user['uid']}/private/apikeys").get()
        user_keys = keys_doc.to_dict() or {} if keys_doc.exists else {}
    except Exception:
        user_keys = {}

    gemini_key = user_keys.get("gemini") or settings.gemini_api_key
    if not gemini_key:
        raise HTTPException(400, "No Gemini API key configured")

    system_prompt = data.get("systemPrompt") or "You are a helpful AI assistant."
    result_parts = []

    try:
        async for token in gemini.stream_chat(
            data["prompt"], data.get("model", "gemini-2.5-flash"),
            [], system_prompt, gemini_key, mode="chat",
        ):
            result_parts.append(token)
    except Exception as e:
        raise HTTPException(500, f"AI execution failed: {e}")

    result = "".join(result_parts)

    # Save result and save to conversation
    ref.update({
        "lastRunAt": SERVER_TIMESTAMP,
        "lastResult": result[:2000],
        "runCount": (data.get("runCount") or 0) + 1,
        "updatedAt": SERVER_TIMESTAMP,
    })

    # Create a conversation entry with the result
    db.collection("conversations").add({
        "userId": user["uid"],
        "title": f"[Scheduled] {data['name']}",
        "model": data.get("model", "gemini-2.5-flash"),
        "archived": False,
        "scheduleId": schedule_id,
        "createdAt": SERVER_TIMESTAMP,
        "updatedAt": SERVER_TIMESTAMP,
    })

    return {"result": result, "runCount": (data.get("runCount") or 0) + 1}


def _safe(d: dict) -> dict:
    """Convert Firestore values to JSON-serializable types."""
    out = {}
    for k, v in d.items():
        try:
            import json; json.dumps(v)
            out[k] = v
        except (TypeError, ValueError):
            out[k] = str(v)
    return out
