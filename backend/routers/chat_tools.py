"""
Chat-with-Tools router — /api/chat-tools

Gemini primary (multi-key rotation + model fallback) → OpenAI fallback (function calling).

SSE event stream:
  {"type": "tool_call",   "id": "tc_1", "name": "web_search", "args": {...}}
  {"type": "tool_result", "id": "tc_1", "name": "web_search", "result": {...}}
  {"type": "token",       "content": "..."}
  {"type": "done"}
  {"type": "error",       "message": "..."}
"""
from __future__ import annotations

import asyncio
import concurrent.futures
import json
import logging
import os
from typing import AsyncGenerator

import google.generativeai as genai
import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.auth import verify_token
from core.config import get_settings
from core.ratelimit import check_rate_limit
from mcp.gateway import get_gateway

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_TOOL_TURNS = 5

# Same fallback chain as gemini service
TOOL_MODEL_CHAIN = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash-001",
]

_WORKERS = min(32, (os.cpu_count() or 4) * 4)
_executor = concurrent.futures.ThreadPoolExecutor(max_workers=_WORKERS, thread_name_prefix="chat_tools")
_semaphore = asyncio.Semaphore(24)

TOOLS_SYSTEM_PROMPT = """\
You are Pyxis, an AI assistant with real-time tools. CRITICAL RULES:
1. You do NOT know the current date/time — ALWAYS call get_datetime.
2. You cannot check current weather — ALWAYS call get_weather.
3. For news or recent events — ALWAYS call web_search or get_news.
4. For math/calculations — call calculate for accuracy.
5. For unit conversions — call convert_units.
6. To run or test code — call run_code.
7. To generate an image — call generate_image.
8. To read a URL — call read_url.
Never guess real-time data. Use tools first, then synthesize the result into a clear answer.\
"""


class HistoryItem(BaseModel):
    role: str
    content: str


class ChatToolsRequest(BaseModel):
    message: str
    model: str = "gemini-2.5-flash"
    history: list[HistoryItem] = []
    systemPrompt: str = ""
    tools_enabled: bool = True


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


def _get_mcp_tools() -> tuple[list[genai.protos.FunctionDeclaration], dict[str, str]]:
    """Build genai FunctionDeclaration list from MCP gateway + server routing map."""
    gateway = get_gateway()
    declarations = []
    tool_server_map: dict[str, str] = {}

    for slug, tools in gateway.list_all_tools().items():
        for t in tools:
            schema = t.input_schema or {}
            # Remove unsupported fields
            schema = {k: v for k, v in schema.items() if k not in ("$schema",)}
            if schema.get("type") != "object":
                schema = {"type": "object", "properties": {}}

            declarations.append(
                genai.protos.FunctionDeclaration(
                    name=t.name,
                    description=t.description,
                    parameters=genai.protos.Schema(
                        type=genai.protos.Type.OBJECT,
                        properties={
                            k: _prop_to_schema(v)
                            for k, v in schema.get("properties", {}).items()
                        },
                        required=schema.get("required", []),
                    ),
                )
            )
            tool_server_map[t.name] = slug

    return declarations, tool_server_map


def _prop_to_schema(prop: dict) -> genai.protos.Schema:
    """Convert a JSON Schema property dict to genai Schema."""
    TYPE_MAP = {
        "string":  genai.protos.Type.STRING,
        "integer": genai.protos.Type.INTEGER,
        "number":  genai.protos.Type.NUMBER,
        "boolean": genai.protos.Type.BOOLEAN,
        "array":   genai.protos.Type.ARRAY,
        "object":  genai.protos.Type.OBJECT,
    }
    t = TYPE_MAP.get(prop.get("type", "string"), genai.protos.Type.STRING)
    return genai.protos.Schema(type=t, description=prop.get("description", ""))


async def _tool_chat_stream(
    req: ChatToolsRequest,
    api_key: str,
    openai_key: str = "",
) -> AsyncGenerator[str, None]:
    """
    Multi-turn function-calling loop using the genai SDK:
      1. Build tool declarations from MCP gateway
      2. Call Gemini with function_calling_config=AUTO
      3. If the model calls tools → execute them → feed results back
      4. Loop until pure text response (max MAX_TOOL_TURNS times)
      5. Stream final text in chunks for a live typing feel
    """
    if req.tools_enabled:
        declarations, tool_server_map = _get_mcp_tools()
        tools = [genai.protos.Tool(function_declarations=declarations)] if declarations else []
    else:
        tools, tool_server_map = [], {}

    system_prompt = req.systemPrompt or TOOLS_SYSTEM_PROMPT

    # Build history in genai format
    history_parts = []
    for h in req.history[-20:]:
        role = "user" if h.role == "user" else "model"
        history_parts.append({"role": role, "parts": [h.content]})

    models_to_try = [req.model if req.model.startswith("gemini") else "gemini-2.5-flash"]
    models_to_try += [m for m in TOOL_MODEL_CHAIN if m not in models_to_try]

    async with _semaphore:
        for model_name in models_to_try:
            result_queue: asyncio.Queue = asyncio.Queue()
            loop = asyncio.get_event_loop()

            # Run the full multi-turn tool loop in a thread (SDK is sync)
            _loop = loop  # capture for closure safety
            def _run_tool_loop(mn=model_name, q=result_queue, _lp=_loop, _key=api_key):
                try:
                    logger.info("Tool loop starting: model=%s tools=%d", mn, len(tools))
                    client = genai.Client(api_key=_key) if hasattr(genai, 'Client') else None
                    genai.configure(api_key=_key)
                    model = genai.GenerativeModel(
                        model_name=mn,
                        system_instruction=system_prompt,
                        tools=tools if tools else None,
                        generation_config=genai.GenerationConfig(
                            temperature=0.65,
                            max_output_tokens=8192,
                        ),
                    )

                    chat = model.start_chat(history=history_parts)

                    # Multi-turn loop
                    current_message = req.message
                    for turn in range(MAX_TOOL_TURNS + 1):
                        response = chat.send_message(current_message)

                        # Check for function calls
                        func_calls = []
                        for part in response.parts:
                            if hasattr(part, "function_call") and part.function_call.name:
                                fc = part.function_call
                                func_calls.append({
                                    "name": fc.name,
                                    "args": dict(fc.args) if fc.args else {},
                                })
                        logger.info("Tool loop turn=%d: %s", turn, [f["name"] for f in func_calls] or "text response")

                        if func_calls and turn < MAX_TOOL_TURNS:
                            # Signal tool calls to stream — will be executed async later
                            _lp.call_soon_threadsafe(q.put_nowait, {"_type": "TOOL_CALLS", "calls": func_calls})
                            # Block until we get tool results back
                            results_future = asyncio.run_coroutine_threadsafe(
                                _wait_for_tool_results(func_calls, tool_server_map),
                                _lp,
                            )
                            tool_results = results_future.result(timeout=30)
                            # Stream tool results
                            _lp.call_soon_threadsafe(q.put_nowait, {"_type": "TOOL_RESULTS", "results": tool_results})

                            # Build function response parts for the next turn
                            fn_response_parts = [
                                genai.protos.Part(
                                    function_response=genai.protos.FunctionResponse(
                                        name=r["name"],
                                        response={"result": r["result"]},
                                    )
                                )
                                for r in tool_results
                            ]
                            current_message = fn_response_parts
                            continue

                        # Pure text response — stream it
                        text = ""
                        try:
                            text = response.text or ""
                        except Exception:
                            pass
                        if not text:
                            for part in response.parts:
                                try:
                                    if part.text:
                                        text += part.text
                                except Exception:
                                    pass
                        _lp.call_soon_threadsafe(q.put_nowait, {"_type": "TEXT", "text": text})
                        break

                except Exception as exc:
                    logger.exception("Tool loop error: %s", exc)
                    _lp.call_soon_threadsafe(q.put_nowait, exc)
                finally:
                    _lp.call_soon_threadsafe(q.put_nowait, None)  # sentinel

            _loop.run_in_executor(_executor, _run_tool_loop)

            # Consume queue and yield SSE events
            rate_limited = False
            got_response = False
            call_idx = 0

            while True:
                try:
                    item = await asyncio.wait_for(result_queue.get(), timeout=60.0)
                except asyncio.TimeoutError:
                    yield _sse({"type": "error", "message": "Request timed out"})
                    yield _sse({"type": "done"})
                    return

                if item is None:
                    break

                if isinstance(item, Exception):
                    err = str(item).lower()
                    if any(k in err for k in ("429", "quota", "rate", "exhausted", "resource")):
                        logger.warning("Model %s rate-limited → trying next", model_name)
                        rate_limited = True
                    else:
                        msg = str(item)
                        if "key=" in msg or "googleapis" in msg:
                            msg = "AI provider error. Please retry."
                        yield _sse({"type": "error", "message": msg})
                        yield _sse({"type": "done"})
                        return
                    break

                if not isinstance(item, dict):
                    continue

                t = item.get("_type")

                if t == "TOOL_CALLS":
                    for fc in item["calls"]:
                        call_idx += 1
                        yield _sse({
                            "type": "tool_call",
                            "id": f"tc_{call_idx}",
                            "name": fc["name"],
                            "server": tool_server_map.get(fc["name"], "builtin"),
                            "args": fc["args"],
                        })

                elif t == "TOOL_RESULTS":
                    for r in item["results"]:
                        yield _sse({
                            "type": "tool_result",
                            "id": f"tc_{r['_idx']}",
                            "name": r["name"],
                            "server": tool_server_map.get(r["name"], "builtin"),
                            "result": r["result"],
                        })

                elif t == "TEXT":
                    text = item.get("text", "")
                    got_response = True
                    # Emit in small chunks for streaming feel
                    chunk_size = 8
                    for i in range(0, len(text), chunk_size):
                        yield _sse({"type": "token", "content": text[i:i + chunk_size]})
                        await asyncio.sleep(0.008)

            if got_response:
                yield _sse({"type": "done"})
                return
            if not rate_limited:
                yield _sse({"type": "error", "message": "No response generated"})
                yield _sse({"type": "done"})
                return

        # All Gemini models exhausted → try OpenAI function calling
        logger.warning("All Gemini models rate-limited — falling back to OpenAI tool calling")
        async for event in _openai_tool_stream(req, openai_key, tool_server_map if req.tools_enabled else {}):
            yield event


def _get_openai_tools(tool_server_map: dict[str, str]) -> list[dict]:
    """Build OpenAI function-calling tools list from MCP gateway."""
    gateway = get_gateway()
    result = []
    for slug, tools in gateway.list_all_tools().items():
        for t in tools:
            schema = t.input_schema or {}
            schema = {k: v for k, v in schema.items() if k not in ("$schema",)}
            if schema.get("type") != "object":
                schema = {"type": "object", "properties": {}}
            result.append({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description or "",
                    "parameters": schema,
                },
            })
    return result


# OpenAI-compatible providers with function calling support
# Tried in order when Gemini is exhausted — Groq first (best free function calling)
_HTTP_TOOL_PROVIDERS = [
    # (name, base_url, model, key_attr)
    ("groq",      "https://api.groq.com/openai/v1",     "llama-3.3-70b-versatile",  "groq_api_key"),
    ("openai",    "https://api.openai.com/v1",          "gpt-4o-mini",              "openai_api_key"),
    ("cerebras",  "https://api.cerebras.ai/v1",         "llama3.3-70b",             "cerebras_api_key"),
]


async def _http_tool_stream_one(
    req: ChatToolsRequest,
    base_url: str,
    model: str,
    api_key: str,
    tool_server_map: dict[str, str],
    oai_tools: list[dict],
    provider_name: str,
) -> AsyncGenerator[str, None]:
    """Single-provider multi-turn tool calling via OpenAI-compatible API.
    Raises ValueError('rate_limited') on 429 so caller can try next provider."""
    system_prompt = req.systemPrompt or TOOLS_SYSTEM_PROMPT
    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for h in req.history[-20:]:
        messages.append({"role": "user" if h.role == "user" else "assistant", "content": h.content})
    messages.append({"role": "user", "content": req.message})

    call_idx = 0
    got_response = False

    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=8.0)) as client:
        for turn in range(MAX_TOOL_TURNS + 1):
            payload: dict = {
                "model": model,
                "messages": messages,
                "max_tokens": 8192,
                "temperature": 0.65,
            }
            if oai_tools:
                payload["tools"] = oai_tools
                # First turn: force the model to call a tool (prevents hallucinated "I can't access" responses)
                # Subsequent turns: auto (model synthesizes results into final answer)
                payload["tool_choice"] = "required" if turn == 0 else "auto"

            resp = await client.post(
                f"{base_url}/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )
            if resp.status_code == 429:
                raise ValueError("rate_limited")
            if not resp.is_success:
                raise ValueError(f"HTTP {resp.status_code}")

            data = resp.json()
            choice = data["choices"][0]
            msg = choice["message"]

            tool_calls = msg.get("tool_calls") or []
            if tool_calls and turn < MAX_TOOL_TURNS:
                func_calls = []
                for tc in tool_calls:
                    fn = tc["function"]
                    call_idx += 1
                    args = {}
                    try:
                        args = json.loads(fn["arguments"])
                    except Exception:
                        pass
                    func_calls.append({"name": fn["name"], "args": args, "_oai_id": tc["id"]})
                    yield _sse({
                        "type": "tool_call",
                        "id": f"tc_{call_idx}",
                        "name": fn["name"],
                        "server": tool_server_map.get(fn["name"], "builtin"),
                        "args": args,
                    })

                results = await _wait_for_tool_results(func_calls, tool_server_map)
                for r in results:
                    yield _sse({
                        "type": "tool_result",
                        "id": f"tc_{r['_idx']}",
                        "name": r["name"],
                        "server": tool_server_map.get(r["name"], "builtin"),
                        "result": r["result"],
                    })

                messages.append(msg)
                for fc, r in zip(func_calls, results):
                    result_str = json.dumps(r["result"]) if not isinstance(r["result"], str) else r["result"]
                    messages.append({
                        "role": "tool",
                        "tool_call_id": fc["_oai_id"],
                        "content": result_str[:4000],
                    })
                continue

            text = msg.get("content") or ""
            got_response = True
            chunk_size = 8
            for i in range(0, len(text), chunk_size):
                yield _sse({"type": "token", "content": text[i:i + chunk_size]})
                await asyncio.sleep(0.008)
            yield _sse({"type": "done"})
            return

    if not got_response:
        raise ValueError("no_response")


async def _openai_tool_stream(
    req: ChatToolsRequest,
    openai_key: str,
    tool_server_map: dict[str, str],
) -> AsyncGenerator[str, None]:
    """Try OpenAI → Groq → Cerebras for tool calling. Used as Gemini fallback."""
    settings = get_settings()
    oai_tools = _get_openai_tools(tool_server_map) if req.tools_enabled else []

    provider_keys = {
        "openai_api_key":    openai_key or settings.openai_api_key or "",
        "groq_api_key":      settings.groq_api_key or "",
        "cerebras_api_key":  settings.cerebras_api_key or "",
    }

    for name, base_url, model, key_attr in _HTTP_TOOL_PROVIDERS:
        api_key = provider_keys.get(key_attr, "")
        if not api_key:
            continue
        logger.info("Tool calling via %s (%s)", name, model)
        try:
            # Collect SSE events — yield all, but if rate_limited raise to try next
            buffer = []
            rate_limited = False
            async for event in _http_tool_stream_one(req, base_url, model, api_key, tool_server_map, oai_tools, name):
                buffer.append(event)
            for event in buffer:
                yield event
            return
        except ValueError as e:
            if "rate_limited" in str(e):
                logger.warning("Tool provider %s rate-limited → trying next", name)
                continue
            logger.warning("Tool provider %s error: %s → trying next", name, e)
            continue
        except Exception as exc:
            logger.warning("Tool provider %s exception: %s → trying next", name, exc)
            continue

    yield _sse({"type": "error", "message": "All AI models are rate-limited. Please wait 60 seconds and retry."})
    yield _sse({"type": "done"})


async def _wait_for_tool_results(
    func_calls: list[dict],
    tool_server_map: dict[str, str],
) -> list[dict]:
    """Execute all tool calls concurrently and return results with index."""
    gateway = get_gateway()

    async def _call_one(idx: int, fc: dict) -> dict:
        name = fc["name"]
        args = fc.get("args", {})
        slug = tool_server_map.get(name, "builtin")
        try:
            result = await asyncio.wait_for(
                gateway.call_tool(slug, name, args),
                timeout=20.0,
            )
        except asyncio.TimeoutError:
            result = {"error": f"Tool '{name}' timed out"}
        except Exception as exc:
            result = {"error": str(exc)}
        return {"_idx": idx + 1, "name": name, "result": result}

    results = await asyncio.gather(*[_call_one(i, fc) for i, fc in enumerate(func_calls)])
    return list(results)


# ── Endpoints ──────────────────────────────────────────────────────────

@router.post("/chat-tools")
async def chat_tools(
    req: ChatToolsRequest,
    user: dict = Depends(check_rate_limit("chat")),
):
    """Streaming AI chat with full MCP tool use."""
    import time as _time
    settings = get_settings()
    gemini_keys = settings.gemini_keys_list
    gemini_key = gemini_keys[int(_time.monotonic() * 1000) % len(gemini_keys)] if gemini_keys else ""
    openai_key = settings.openai_api_key or ""

    if not gemini_key and not openai_key:
        async def _no_key():
            yield _sse({"type": "error", "message": "No AI API key configured"})
            yield _sse({"type": "done"})
        return StreamingResponse(_no_key(), media_type="text/event-stream")

    # If no Gemini key but OpenAI available, go straight to OpenAI
    if not gemini_key:
        gateway = get_gateway()
        tool_server_map = {t.name: slug for slug, tools in gateway.list_all_tools().items() for t in tools}
        return StreamingResponse(
            _openai_tool_stream(req, openai_key, tool_server_map if req.tools_enabled else {}),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
        )

    return StreamingResponse(
        _tool_chat_stream(req, gemini_key, openai_key),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/chat-tools/available")
async def list_available_tools(user: dict = Depends(verify_token)):
    """List all MCP tools available to the chat assistant."""
    gateway = get_gateway()
    result = []
    for slug, tools in gateway.list_all_tools().items():
        for t in tools:
            result.append({
                "server": slug,
                "name": t.name,
                "description": t.description,
                "input_schema": t.input_schema,
            })
    return result
