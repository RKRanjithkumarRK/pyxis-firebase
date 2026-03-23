"""
Firebase Admin SDK — lazy singleton initialization.
Safe to import before env vars are loaded.
"""

import logging

import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth

from .config import get_settings

logger = logging.getLogger(__name__)

_app: firebase_admin.App | None = None
_initialized = False


def _init() -> bool:
    global _app, _initialized
    if _initialized:
        return _app is not None

    _initialized = True
    settings = get_settings()

    if not all([
        settings.firebase_project_id,
        settings.firebase_client_email,
        settings.firebase_private_key,
    ]):
        logger.warning(
            "Firebase Admin: one or more credentials missing. "
            "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY."
        )
        return False

    try:
        cred = credentials.Certificate({
            "type": "service_account",
            "project_id": settings.firebase_project_id,
            "client_email": settings.firebase_client_email,
            # Handles both literal \n and real newlines in env var
            "private_key": settings.firebase_private_key.replace("\\n", "\n"),
            "token_uri": "https://oauth2.googleapis.com/token",
        })
        # Only initialize if no app exists yet (prevents duplicate-app error on hot reload)
        if not firebase_admin._apps:
            _app = firebase_admin.initialize_app(cred)
        else:
            _app = firebase_admin.get_app()
        logger.info("Firebase Admin initialized OK")
        return True
    except Exception as exc:
        logger.error(f"Firebase Admin init failed: {exc}")
        return False


def get_firestore():
    """Return a Firestore client. Initializes Firebase on first call."""
    _init()
    return firestore.client()


def get_auth():
    """Return the firebase_admin.auth module (not a class instance — it's a module API)."""
    _init()
    return firebase_auth
