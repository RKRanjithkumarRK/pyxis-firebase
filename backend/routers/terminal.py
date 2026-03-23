"""
Interactive terminal router — /ws/terminal

Opens a real PTY (pseudo-terminal) session per WebSocket connection.
- Windows : uses pywinpty  (winpty.PtyProcess)
- Linux   : uses ptyprocess (PtyProcessUnicode)

Protocol:
  client → server: raw bytes (keystrokes / paste)
                   OR JSON  {"type":"resize","cols":N,"rows":N}
  server → client: raw bytes (terminal output)

Auth: pass Firebase ID token as query param ?token=<jwt>
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import threading
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

logger = logging.getLogger(__name__)
router = APIRouter()

# ── PTY backend ─────────────────────────────────────────────────────────────

if sys.platform == "win32":
    from winpty import PtyProcess as _WinPty

    def _spawn(cols: int, rows: int) -> Any:
        # powershell gives a nicer experience than cmd on Windows
        shell = os.environ.get("COMSPEC", "cmd.exe")
        return _WinPty.spawn(shell, dimensions=(rows, cols))

    def _read(proc: Any) -> bytes | None:
        try:
            data = proc.read(4096)
            if isinstance(data, str):
                return data.encode("utf-8", errors="replace")
            return data
        except Exception:
            return None

    def _write(proc: Any, data: bytes) -> None:
        try:
            proc.write(data.decode("utf-8", errors="replace"))
        except Exception:
            pass

    def _resize(proc: Any, cols: int, rows: int) -> None:
        try:
            proc.setwinsize(rows, cols)
        except Exception:
            pass

    def _alive(proc: Any) -> bool:
        try:
            return proc.isalive()
        except Exception:
            return False

    def _terminate(proc: Any) -> None:
        try:
            proc.terminate(force=True)
        except Exception:
            pass

else:
    import ptyprocess  # type: ignore

    def _spawn(cols: int, rows: int) -> Any:
        shell = os.environ.get("SHELL", "/bin/bash")
        return ptyprocess.PtyProcess.spawn([shell, "--login"], dimensions=(rows, cols))

    def _read(proc: Any) -> bytes | None:
        try:
            return proc.read(4096)
        except Exception:
            return None

    def _write(proc: Any, data: bytes) -> None:
        try:
            proc.write(data)
        except Exception:
            pass

    def _resize(proc: Any, cols: int, rows: int) -> None:
        try:
            proc.setwinsize(rows, cols)
        except Exception:
            pass

    def _alive(proc: Any) -> bool:
        try:
            return proc.isalive()
        except Exception:
            return False

    def _terminate(proc: Any) -> None:
        try:
            proc.terminate(force=True)
        except Exception:
            pass


# ── Run code helper — write to temp file, execute in PTY ────────────────────

import tempfile

_LANG_CMD = {
    "python":     lambda p: f'python -u "{p}"\r\n',
    "javascript": lambda p: f'node "{p}"\r\n',
    "typescript": lambda p: f'npx ts-node "{p}"\r\n',
    "bash":       lambda p: f'bash "{p}"\r\n',
    "shell":      lambda p: f'bash "{p}"\r\n',
    "go":         lambda p: f'go run "{p}"\r\n',
    "rust":       lambda p: f'rustc "{p}" -o /tmp/_pyxis_out && /tmp/_pyxis_out\r\n',
}
_LANG_EXT = {
    "python": ".py", "javascript": ".js", "typescript": ".ts",
    "bash": ".sh", "shell": ".sh", "go": ".go", "rust": ".rs",
}


async def _run_code_in_pty(proc: Any, code: str, language: str) -> None:
    """Write code to a temp file and issue the run command into the PTY."""
    lang = language.lower()
    ext  = _LANG_EXT.get(lang, ".txt")
    cmd_fn = _LANG_CMD.get(lang)
    if not cmd_fn:
        _write(proc, f'\r\nUnsupported language: {language}\r\n'.encode())
        return

    loop = asyncio.get_event_loop()
    try:
        tmp = await loop.run_in_executor(
            None,
            lambda: _write_temp(code, ext),
        )
        _write(proc, cmd_fn(tmp).encode())
    except Exception as exc:
        _write(proc, f'\r\nFailed to run: {exc}\r\n'.encode())


def _write_temp(code: str, ext: str) -> str:
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=ext, delete=False, encoding="utf-8"
    ) as f:
        f.write(code)
        return f.name


# ── WebSocket endpoint ───────────────────────────────────────────────────────

@router.websocket("/ws/terminal")
async def terminal_ws(
    websocket: WebSocket,
    token: str = Query(default=""),
    cols: int = Query(default=80),
    rows: int = Query(default=24),
):
    # ── Auth ────────────────────────────────────────────────────────────
    if token:
        try:
            from firebase_admin import auth as fb_auth
            fb_auth.verify_id_token(token)
        except Exception as exc:
            logger.warning("Terminal WS: invalid token — %s", exc)
            await websocket.close(code=4001, reason="Unauthorized")
            return
    # In development with no token, allow (Vite dev server is trusted)

    await websocket.accept()
    logger.info("Terminal WS: connected (cols=%d rows=%d)", cols, rows)

    # ── Spawn PTY ────────────────────────────────────────────────────────
    try:
        proc = _spawn(cols, rows)
    except Exception as exc:
        logger.exception("Terminal WS: failed to spawn PTY — %s", exc)
        await websocket.send_bytes(
            f"\r\n\x1b[31mFailed to start terminal: {exc}\x1b[0m\r\n".encode()
        )
        await websocket.close()
        return

    loop = asyncio.get_event_loop()
    out_queue: asyncio.Queue[bytes | None] = asyncio.Queue()

    # ── Reader thread: PTY stdout → queue ────────────────────────────────
    def _reader():
        while _alive(proc):
            chunk = _read(proc)
            if chunk is None:
                break
            loop.call_soon_threadsafe(out_queue.put_nowait, chunk)
        loop.call_soon_threadsafe(out_queue.put_nowait, None)  # EOF sentinel

    threading.Thread(target=_reader, daemon=True, name="pty-reader").start()

    # ── Send PTY output to WebSocket ─────────────────────────────────────
    async def _send_loop():
        while True:
            chunk = await out_queue.get()
            if chunk is None:
                break
            try:
                await websocket.send_bytes(chunk)
            except Exception:
                break

    # ── Receive keystrokes from WebSocket → PTY stdin ────────────────────
    async def _recv_loop():
        while True:
            try:
                msg = await websocket.receive()
            except (WebSocketDisconnect, Exception):
                break

            if "bytes" in msg and msg["bytes"]:
                _write(proc, msg["bytes"])
            elif "text" in msg and msg["text"]:
                text = msg["text"]
                try:
                    parsed = json.loads(text)
                    kind = parsed.get("type")

                    if kind == "resize":
                        _resize(proc, int(parsed["cols"]), int(parsed["rows"]))

                    elif kind == "run_code":
                        await _run_code_in_pty(proc, parsed.get("code", ""), parsed.get("language", "python"))

                except (json.JSONDecodeError, KeyError):
                    # Plain text input
                    _write(proc, text.encode("utf-8", errors="replace"))

    try:
        await asyncio.gather(_send_loop(), _recv_loop())
    except Exception as exc:
        logger.debug("Terminal WS: session ended — %s", exc)
    finally:
        _terminate(proc)
        logger.info("Terminal WS: disconnected")
