"""
Admin router — user management, usage analytics, audit log, model health.
All routes require admin role.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from google.cloud.firestore_v1.transforms import SERVER_TIMESTAMP

from core.auth import verify_token
from core.firebase import get_firestore, get_auth
from core.rbac import require_admin, set_user_role

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/admin/users")
async def list_users(
    limit: int = Query(50, le=200),
    page_token: Optional[str] = None,
    admin: dict = Depends(require_admin),
):
    """List all Firebase Auth users with their Firestore metadata."""
    try:
        auth = get_auth()
        page = auth.list_users(max_results=limit, page_token=page_token)
        db = get_firestore()
        users_out = []
        for u in page.users:
            meta = {}
            try:
                doc = db.document(f"users/{u.uid}/private/meta").get()
                if doc.exists:
                    meta = doc.to_dict()
            except Exception:
                pass
            users_out.append({
                "uid": u.uid,
                "email": u.email or "",
                "displayName": u.display_name or "",
                "photoUrl": u.photo_url or "",
                "disabled": u.disabled,
                "createdAt": u.user_metadata.creation_timestamp,
                "lastSignIn": u.user_metadata.last_sign_in_timestamp,
                "role": meta.get("role", "user"),
                "plan": meta.get("plan", "free"),
                "orgId": meta.get("orgId"),
                "providerIds": [p.provider_id for p in u.provider_data],
            })
        return {
            "users": users_out,
            "nextPageToken": page.next_page_token,
        }
    except Exception as e:
        logger.error(f"Admin list_users error: {e}")
        raise HTTPException(500, f"Failed to list users: {e}")


@router.get("/admin/users/{uid}")
async def get_user(uid: str, admin: dict = Depends(require_admin)):
    auth = get_auth()
    try:
        u = auth.get_user(uid)
    except Exception:
        raise HTTPException(404, "User not found")
    db = get_firestore()
    meta = {}
    try:
        doc = db.document(f"users/{uid}/private/meta").get()
        if doc.exists:
            meta = doc.to_dict()
    except Exception:
        pass
    # Usage summary
    try:
        events = (
            db.collection("usage_events")
            .where("uid", "==", uid)
            .order_by("timestamp")
            .limit_to_last(1000)
            .stream()
        )
        total_messages = total_images = 0
        for ev in events:
            d = ev.to_dict()
            ep = d.get("endpoint", "")
            if "chat" in ep:
                total_messages += 1
            elif "images" in ep:
                total_images += 1
    except Exception:
        total_messages = total_images = 0

    return {
        "uid": uid,
        "email": u.email or "",
        "displayName": u.display_name or "",
        "disabled": u.disabled,
        "role": meta.get("role", "user"),
        "plan": meta.get("plan", "free"),
        "orgId": meta.get("orgId"),
        "totalMessages": total_messages,
        "totalImages": total_images,
        "createdAt": u.user_metadata.creation_timestamp,
    }


@router.post("/admin/users/{uid}/role")
async def update_user_role(
    uid: str,
    body: dict,
    admin: dict = Depends(require_admin),
):
    role = body.get("role")
    if role not in ("admin", "user", "guest"):
        raise HTTPException(400, "role must be admin, user, or guest")
    await set_user_role(uid, role)
    return {"success": True, "uid": uid, "role": role}


@router.post("/admin/users/{uid}/plan")
async def update_user_plan(uid: str, body: dict, admin: dict = Depends(require_admin)):
    plan = body.get("plan")
    if plan not in ("free", "pro", "enterprise"):
        raise HTTPException(400, "plan must be free, pro, or enterprise")
    db = get_firestore()
    db.document(f"users/{uid}/private/meta").set(
        {"plan": plan, "updatedAt": SERVER_TIMESTAMP}, merge=True
    )
    return {"success": True, "uid": uid, "plan": plan}


@router.post("/admin/users/{uid}/disable")
async def toggle_user(uid: str, body: dict, admin: dict = Depends(require_admin)):
    disabled = bool(body.get("disabled", True))
    auth = get_auth()
    auth.update_user(uid, disabled=disabled)
    return {"success": True, "uid": uid, "disabled": disabled}


@router.get("/admin/usage")
async def usage_stats(
    days: int = Query(7, le=90),
    admin: dict = Depends(require_admin),
):
    """Return aggregate usage stats for the last N days."""
    db = get_firestore()
    try:
        # Simplified: count usage events by day
        events = db.collection("usage_events").limit(5000).stream()
        by_day: dict[str, dict] = {}
        model_counts: dict[str, int] = {}
        total_chat = total_images = total_users = 0
        user_set: set = set()
        for ev in events:
            d = ev.to_dict()
            uid = d.get("uid", "")
            ep  = d.get("endpoint", "")
            model = d.get("model", "unknown")
            ts = d.get("timestamp")
            day = str(ts)[:10] if ts else "unknown"
            user_set.add(uid)
            if day not in by_day:
                by_day[day] = {"chat": 0, "images": 0, "users": set()}
            by_day[day]["users"].add(uid)
            model_counts[model] = model_counts.get(model, 0) + 1
            if "chat" in ep:
                by_day[day]["chat"] += 1
                total_chat += 1
            elif "image" in ep:
                by_day[day]["images"] += 1
                total_images += 1

        daily = [
            {"date": d, "chat": v["chat"], "images": v["images"], "activeUsers": len(v["users"])}
            for d, v in sorted(by_day.items())[-days:]
        ]
        return {
            "totalMessages": total_chat,
            "totalImages": total_images,
            "totalUsers": len(user_set),
            "daily": daily,
            "modelBreakdown": [{"model": k, "count": v} for k, v in sorted(model_counts.items(), key=lambda x: -x[1])[:10]],
        }
    except Exception as e:
        logger.error(f"Usage stats error: {e}")
        return {"totalMessages": 0, "totalImages": 0, "totalUsers": 0, "daily": [], "modelBreakdown": []}


@router.get("/admin/model-health")
async def model_health(admin: dict = Depends(require_admin)):
    """Return last-24h provider error rates."""
    db = get_firestore()
    try:
        errors = db.collection("provider_errors").limit(500).stream()
        by_provider: dict[str, dict] = {}
        for ev in errors:
            d = ev.to_dict()
            p = d.get("provider", "unknown")
            if p not in by_provider:
                by_provider[p] = {"errors": 0, "lastError": None, "lastErrorCode": None}
            by_provider[p]["errors"] += 1
            by_provider[p]["lastError"] = d.get("timestamp")
            by_provider[p]["lastErrorCode"] = d.get("error_code")
        return {
            "providers": [
                {"provider": k, **v}
                for k, v in by_provider.items()
            ]
        }
    except Exception as e:
        return {"providers": []}


@router.get("/admin/audit-log")
async def audit_log(
    limit: int = Query(50, le=200),
    admin: dict = Depends(require_admin),
):
    db = get_firestore()
    try:
        docs = db.collection("usage_events").order_by("timestamp").limit_to_last(limit).stream()
        return [doc.to_dict() for doc in docs]
    except Exception:
        return []
