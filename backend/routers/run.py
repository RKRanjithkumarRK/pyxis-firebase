"""
Code execution router.

Priority:
  1. Python / Bash / Shell  →  native asyncio subprocess  (fast, zero-dependency)
  2. JS / TS / Go / Rust … →  Judge0 Community Edition   (external API)
  3. If Judge0 fails        →  friendly error with guidance
"""

import asyncio
import base64
import logging
import os
import subprocess
import sys
import tempfile

import httpx
from fastapi import APIRouter, Depends, HTTPException

from core.auth import verify_token
from core.config import get_settings
from schemas.models import RunRequest, RunResponse

logger = logging.getLogger(__name__)
router = APIRouter()

JUDGE0_BASE  = "https://judge0-ce.p.rapidapi.com"
LANGUAGE_IDS = {
    "python":     71,
    "javascript": 63,
    "typescript": 74,
    "bash":       46,
    "shell":      46,
    "go":         60,
    "rust":       73,
    "java":       62,
    "cpp":        54,
    "csharp":     51,
    "sql":        82,
}


# ─────────────────────────────────────────────────────────────────────────────
# Native subprocess executor  (Python, Bash/Shell)
# ─────────────────────────────────────────────────────────────────────────────

def _run_subprocess_sync(code: str, language: str) -> RunResponse:
    """Execute Python or Bash code synchronously via subprocess.run.

    Uses subprocess.run (not asyncio subprocess) so it works on Windows
    where uvicorn runs a SelectorEventLoop that doesn't support
    create_subprocess_exec.
    """
    if language not in ("python", "bash", "shell"):
        raise ValueError(f"Subprocess executor only supports python/bash, not {language}")

    suffix = ".py" if language == "python" else ".sh"
    interpreter = sys.executable if language == "python" else "bash"

    tmp_dir = tempfile.gettempdir()
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=suffix, delete=False, dir=tmp_dir, encoding="utf-8"
    ) as f:
        f.write(code)
        tmp_path = f.name

    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"]        = "1"

    cmd = [interpreter, "-X", "utf8", tmp_path] if language == "python" else [interpreter, tmp_path]
    logger.info("Subprocess exec: %s", " ".join(cmd))
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            timeout=10,
            cwd=tmp_dir,
            env=env,
        )
        return RunResponse(
            stdout=result.stdout.decode("utf-8", errors="replace"),
            stderr=result.stderr.decode("utf-8", errors="replace"),
            compile_output="",
            status="Accepted" if result.returncode == 0 else "Runtime Error",
        )
    except subprocess.TimeoutExpired:
        return RunResponse(
            stdout="", stderr="", compile_output="", status="Time Limit Exceeded",
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


async def _run_subprocess(code: str, language: str) -> RunResponse:
    """Async wrapper — runs the blocking subprocess in the default thread pool."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _run_subprocess_sync, code, language)


def _cmd_exists(cmd: str) -> bool:
    """Check whether a shell command is available on PATH."""
    import shutil
    return shutil.which(cmd) is not None


# ─────────────────────────────────────────────────────────────────────────────
# Judge0 executor  (JS / TS / Go / Rust / Java …)
# ─────────────────────────────────────────────────────────────────────────────

async def _run_judge0(code: str, language: str) -> RunResponse | None:
    """Submit code to Judge0 CE and poll for the result.  Returns None on any failure."""
    lang_id = LANGUAGE_IDS.get(language.lower())
    if not lang_id:
        return None

    api_key = get_settings().judge0_api_key
    if not api_key:
        return RunResponse(
            stdout="",
            stderr="",
            compile_output="",
            status="Not Configured",
            message=(
                f"Code execution for '{language}' requires a Judge0 API key.\n"
                "Add JUDGE0_API_KEY to your .env file (get one free at rapidapi.com/judge0-official/api/judge0-ce).\n"
                "Python and Bash run natively without a key."
            ),
        )

    encoded = base64.b64encode(code.encode()).decode()

    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            # ── Submit ──────────────────────────────────────────
            submit = await client.post(
                f"{JUDGE0_BASE}/submissions",
                params={"base64_encoded": "true", "wait": "false"},
                json={
                    "language_id":    lang_id,
                    "source_code":    encoded,
                    "cpu_time_limit": 10,
                    "wall_time_limit": 15,
                },
                headers={
                    "Content-Type": "application/json",
                    "X-RapidAPI-Key": api_key,
                    "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
                },
            )
            if not submit.is_success:
                logger.warning("Judge0 submit failed: %s", submit.status_code)
                return None

            token = submit.json().get("token")
            if not token:
                return None

            # ── Poll ─────────────────────────────────────────────
            for _ in range(12):
                await asyncio.sleep(1.5)
                result = await client.get(
                    f"{JUDGE0_BASE}/submissions/{token}",
                    params={"base64_encoded": "true"},
                    headers={
                        "X-RapidAPI-Key": api_key,
                        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
                    },
                )
                if not result.is_success:
                    continue

                data      = result.json()
                status_id = data.get("status", {}).get("id", 0)

                if status_id >= 3:  # 3 = Accepted, 4-14 = various errors, all "done"
                    def _b64(val: str | None) -> str:
                        if not val:
                            return ""
                        try:
                            return base64.b64decode(val).decode("utf-8", errors="replace")
                        except Exception:
                            return val

                    return RunResponse(
                        stdout=_b64(data.get("stdout")),
                        stderr=_b64(data.get("stderr")),
                        compile_output=_b64(data.get("compile_output")),
                        status=data.get("status", {}).get("description", "Unknown"),
                    )

            # Polling exhausted
            return None

    except Exception as exc:
        logger.warning("Judge0 error: %s", exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Router endpoint
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/run", response_model=RunResponse)
async def run_code(req: RunRequest, user: dict = Depends(verify_token)):
    language = req.language.lower().strip()

    # Normalise "shell" → "bash"
    if language == "shell":
        language = "bash"

    # ── Fast native path for Python / Bash ──────────────────────
    if language in ("python", "bash"):
        try:
            result = await _run_subprocess(req.code, language)
            logger.info("Subprocess result: status=%s stdout_len=%d stderr_len=%d",
                        result.status, len(result.stdout), len(result.stderr))
            return result
        except Exception as exc:
            logger.warning("Subprocess execution failed (%s), will try Judge0: %s", language, exc, exc_info=True)

    # ── Judge0 for all other languages (and as fallback) ────────
    result = await _run_judge0(req.code, language)
    if result:
        return result

    # ── If Python/Bash subprocess failed, retry once more ───────
    if language in ("python", "bash"):
        try:
            return await _run_subprocess(req.code, language)
        except Exception:
            pass

    # ── Nothing worked ──────────────────────────────────────────
    supported = ", ".join(sorted(LANGUAGE_IDS.keys()))
    raise HTTPException(
        status_code=502,
        detail=(
            f"Code execution unavailable for '{language}'. "
            f"Supported languages: {supported}."
        ),
    )
