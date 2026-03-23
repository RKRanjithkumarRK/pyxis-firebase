"""
JWT verification dependency for FastAPI routes.
Usage:  async def my_route(user: dict = Depends(verify_token))
        user["uid"]  →  Firebase user ID
"""

from fastapi import HTTPException, Request, status
from firebase_admin.exceptions import FirebaseError

from .firebase import get_auth


async def verify_token(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization: Bearer <token> header",
        )

    token = auth_header[7:]  # strip "Bearer "
    try:
        auth = get_auth()
        # clock_skew_seconds=10 tolerates minor clock drift between
        # Firebase token servers and this backend (common in local dev)
        return auth.verify_id_token(token, clock_skew_seconds=10)
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expired — please re-login")
    except auth.RevokedIdTokenError:
        raise HTTPException(status_code=401, detail="Token revoked")
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except FirebaseError as exc:
        raise HTTPException(status_code=401, detail=f"Auth error: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Auth failed: {exc}")
