"""
Built-in MCP tools — the entire product surface exposed as callable tools.

Every major capability of Pyxis is registered here so the AI can invoke any
feature on behalf of the user during a chat session:

  Utility ────────────────────────────────────────────────────────────────────
    get_datetime        current date/time/timezone
    calculate           safe math expression evaluator
    convert_units       length/weight/temp/data unit converter

  Web / Research ─────────────────────────────────────────────────────────────
    web_search          DuckDuckGo HTML scrape + Wikipedia fallback
    get_news            DuckDuckGo news search for any topic
    get_weather         wttr.in current conditions (free, no key)
    read_url            fetch a URL and extract readable text

  AI Generation ──────────────────────────────────────────────────────────────
    generate_image      Pollinations / HuggingFace / DALL-E / Gemini
    enhance_prompt      rewrite a vague prompt into a detailed image prompt

  Code ───────────────────────────────────────────────────────────────────────
    run_code            execute Python (subprocess) or other langs (Judge0)

  Memory / Knowledge ─────────────────────────────────────────────────────────
    save_memory         persist a key fact for the user session
    recall_memory       retrieve previously saved facts
    list_prompt_templates list prompts from the user's prompt library

  Data Utilities ─────────────────────────────────────────────────────────────
    summarize_text      condense long text to key points
    extract_keywords    pull main topics/entities from text
    format_json         pretty-print or minify JSON
"""
from __future__ import annotations

import asyncio
import datetime
import html
import json
import logging
import math
import re
import sys
import tempfile
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# ── In-session memory store (cleared per process restart) ─────────────────
_session_memory: dict[str, list[str]] = {}

# ── Tool registry ─────────────────────────────────────────────────────────
_TOOLS: dict[str, dict] = {}


def _register(name: str, description: str, input_schema: dict):
    def decorator(fn):
        _TOOLS[name] = {"description": description, "input_schema": input_schema, "fn": fn}
        return fn
    return decorator


# ═══════════════════════════════════════════════════════════════════════════
# UTILITY TOOLS
# ═══════════════════════════════════════════════════════════════════════════

@_register(
    "get_datetime",
    "Get the current date, time, day of week, and Unix timestamp.",
    {"type": "object", "properties": {}},
)
async def _get_datetime(**_) -> dict:
    now = datetime.datetime.now()
    utc = datetime.datetime.utcnow()
    return {
        "local_datetime": now.isoformat(timespec="seconds"),
        "utc_datetime": utc.isoformat(timespec="seconds") + "Z",
        "date": now.strftime("%B %d, %Y"),
        "time": now.strftime("%I:%M %p"),
        "day_of_week": now.strftime("%A"),
        "week_number": now.isocalendar()[1],
        "unix_timestamp": int(now.timestamp()),
    }


@_register(
    "calculate",
    "Evaluate a mathematical expression. Supports arithmetic, sqrt, log, sin/cos/tan, pi, e, abs, round, min, max, pow.",
    {
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": "Math expression, e.g. '2 * (3 + 4)', 'sqrt(144)', 'log10(1000)'",
            }
        },
        "required": ["expression"],
    },
)
async def _calculate(expression: str, **_) -> dict:
    safe_ns = {
        "__builtins__": {},
        "math": math, "sqrt": math.sqrt, "pi": math.pi, "e": math.e,
        "abs": abs, "round": round, "min": min, "max": max, "sum": sum,
        "pow": pow, "log": math.log, "log2": math.log2, "log10": math.log10,
        "sin": math.sin, "cos": math.cos, "tan": math.tan,
        "asin": math.asin, "acos": math.acos, "atan": math.atan,
        "floor": math.floor, "ceil": math.ceil, "factorial": math.factorial,
        "gcd": math.gcd, "inf": math.inf, "nan": math.nan,
    }
    try:
        result = eval(expression, safe_ns, {})  # noqa: S307
        return {"result": result, "expression": expression, "formatted": str(result)}
    except ZeroDivisionError:
        return {"error": "Division by zero", "expression": expression}
    except Exception as exc:
        return {"error": str(exc), "expression": expression}


@_register(
    "convert_units",
    "Convert between common units: length (m/km/ft/mi/in/cm), weight (kg/g/lb/oz), temperature (C/F/K), data (B/KB/MB/GB/TB), time (s/min/h/d).",
    {
        "type": "object",
        "properties": {
            "value": {"type": "number", "description": "Numeric value to convert"},
            "from_unit": {"type": "string", "description": "Source unit, e.g. 'km', 'lb', 'C'"},
            "to_unit": {"type": "string", "description": "Target unit, e.g. 'mi', 'kg', 'F'"},
        },
        "required": ["value", "from_unit", "to_unit"],
    },
)
async def _convert_units(value: float, from_unit: str, to_unit: str, **_) -> dict:
    from_unit = from_unit.strip().lower()
    to_unit = to_unit.strip().lower()

    # Convert everything to a base unit, then to target
    # Length → metres
    length = {"m": 1, "km": 1000, "cm": 0.01, "mm": 0.001,
               "mi": 1609.344, "ft": 0.3048, "in": 0.0254, "yd": 0.9144}
    # Weight → grams
    weight = {"g": 1, "kg": 1000, "mg": 0.001, "lb": 453.592,
               "oz": 28.3495, "t": 1_000_000}
    # Data → bytes
    data = {"b": 1, "kb": 1024, "mb": 1024**2, "gb": 1024**3, "tb": 1024**4,
            "kib": 1024, "mib": 1024**2, "gib": 1024**3}
    # Time → seconds
    time_u = {"s": 1, "sec": 1, "min": 60, "h": 3600, "hr": 3600,
               "d": 86400, "day": 86400, "wk": 604800, "week": 604800}

    def _convert(table: dict, v: float, f: str, t: str):
        if f not in table or t not in table:
            return None
        return v * table[f] / table[t]

    # Temperature special case
    temp_pairs = {
        ("c", "f"): lambda v: v * 9/5 + 32,
        ("f", "c"): lambda v: (v - 32) * 5/9,
        ("c", "k"): lambda v: v + 273.15,
        ("k", "c"): lambda v: v - 273.15,
        ("f", "k"): lambda v: (v - 32) * 5/9 + 273.15,
        ("k", "f"): lambda v: (v - 273.15) * 9/5 + 32,
    }
    if (from_unit, to_unit) in temp_pairs:
        result = temp_pairs[(from_unit, to_unit)](value)
        return {"result": round(result, 4), "from": f"{value} {from_unit.upper()}", "to": f"{round(result, 4)} {to_unit.upper()}"}

    for table in (length, weight, data, time_u):
        r = _convert(table, value, from_unit, to_unit)
        if r is not None:
            return {"result": round(r, 6), "from": f"{value} {from_unit}", "to": f"{round(r, 6)} {to_unit}"}

    return {"error": f"Cannot convert '{from_unit}' to '{to_unit}'"}


# ═══════════════════════════════════════════════════════════════════════════
# WEB / RESEARCH TOOLS
# ═══════════════════════════════════════════════════════════════════════════

@_register(
    "web_search",
    "Search the web for current information. Returns titles, snippets, and URLs from DuckDuckGo. Use this for any factual question about recent events, people, products, prices, etc.",
    {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query"},
            "max_results": {"type": "integer", "description": "Number of results (1-8, default 5)"},
        },
        "required": ["query"],
    },
)
async def _web_search(query: str, max_results: int = 5, **_) -> dict:
    results: list[dict] = []
    max_results = max(1, min(8, int(max_results)))

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers={"User-Agent": "Mozilla/5.0 (compatible; Pyxis/1.0)"},
            )
            if resp.is_success:
                h = resp.text
                blocks = re.findall(
                    r'<a class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?'
                    r'<a class="result__snippet"[^>]*>(.*?)</a>',
                    h, re.DOTALL,
                )
                for url, title, snippet in blocks[:max_results]:
                    t = re.sub(r"<[^>]+>", "", title).strip()
                    s = re.sub(r"<[^>]+>", "", snippet).strip()
                    if t and s:
                        results.append({"title": t, "snippet": s, "url": url})
    except Exception:
        pass

    if not results:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    "https://en.wikipedia.org/w/api.php",
                    params={"action": "query", "list": "search", "srsearch": query,
                            "format": "json", "srlimit": min(max_results, 5)},
                    headers={"User-Agent": "Pyxis/1.0 (https://pyxis.app; contact@pyxis.app)"},
                )
                if resp.is_success and resp.content:
                    for item in resp.json().get("query", {}).get("search", []):
                        results.append({
                            "title": item["title"],
                            "snippet": re.sub(r"<[^>]+>", "", item.get("snippet", "")),
                            "url": f"https://en.wikipedia.org/wiki/{item['title'].replace(' ', '_')}",
                        })
        except Exception:
            pass

    return {"query": query, "results": results, "count": len(results)}


@_register(
    "get_news",
    "Fetch the latest news headlines for any topic. Returns titles, snippets, and URLs.",
    {
        "type": "object",
        "properties": {
            "topic": {"type": "string", "description": "News topic, e.g. 'AI', 'finance', 'sports', 'technology'"},
            "max_results": {"type": "integer", "description": "Number of articles (1-8, default 6)"},
        },
        "required": ["topic"],
    },
)
async def _get_news(topic: str, max_results: int = 6, **_) -> dict:
    result = await _web_search(f"{topic} news today", max_results=min(max_results, 8))
    return {"topic": topic, "articles": result.get("results", []), "count": result.get("count", 0)}


@_register(
    "get_weather",
    "Get current weather conditions for any city or location worldwide. Returns temperature, humidity, wind, and description.",
    {
        "type": "object",
        "properties": {
            "location": {"type": "string", "description": "City name or location, e.g. 'London', 'New York', 'Tokyo'"}
        },
        "required": ["location"],
    },
)
async def _get_weather(location: str, **_) -> dict:
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"https://wttr.in/{location}?format=j1",
                headers={"User-Agent": "Pyxis/1.0"},
            )
            if resp.is_success:
                data = resp.json()
                cur = data.get("current_condition", [{}])[0]
                nearest = data.get("nearest_area", [{}])[0]
                area = nearest.get("areaName", [{}])[0].get("value", location)
                country = nearest.get("country", [{}])[0].get("value", "")
                forecast = []
                for day in data.get("weather", [])[:3]:
                    forecast.append({
                        "date": day.get("date"),
                        "max_c": day.get("maxtempC"),
                        "min_c": day.get("mintempC"),
                        "description": day.get("hourly", [{}])[4].get("weatherDesc", [{}])[0].get("value", ""),
                    })
                return {
                    "location": f"{area}, {country}".strip(", "),
                    "temp_c": int(cur.get("temp_C", 0)),
                    "temp_f": int(cur.get("temp_F", 0)),
                    "feels_like_c": int(cur.get("FeelsLikeC", 0)),
                    "description": cur.get("weatherDesc", [{}])[0].get("value", ""),
                    "humidity_pct": int(cur.get("humidity", 0)),
                    "wind_kmph": int(cur.get("windspeedKmph", 0)),
                    "visibility_km": int(cur.get("visibility", 0)),
                    "uv_index": cur.get("uvIndex", "N/A"),
                    "3_day_forecast": forecast,
                }
    except Exception as exc:
        return {"error": str(exc), "location": location}
    return {"error": "Weather data unavailable", "location": location}


@_register(
    "read_url",
    "Fetch a webpage URL and return its readable text content. Useful for reading articles, documentation, or any web page.",
    {
        "type": "object",
        "properties": {
            "url": {"type": "string", "description": "Full URL to fetch (must start with https://)"},
            "max_chars": {"type": "integer", "description": "Maximum characters to return (default 4000, max 8000)"},
        },
        "required": ["url"],
    },
)
async def _read_url(url: str, max_chars: int = 4000, **_) -> dict:
    max_chars = max(500, min(8000, int(max_chars)))
    if not url.startswith("http"):
        return {"error": "URL must start with http:// or https://"}
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; Pyxis/1.0)"})
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            if "html" in content_type:
                text = resp.text
                # Remove scripts, styles, nav, header, footer
                text = re.sub(r'<(script|style|nav|header|footer|aside)[^>]*>.*?</\1>', '', text, flags=re.DOTALL | re.IGNORECASE)
                # Remove all other HTML tags
                text = re.sub(r'<[^>]+>', ' ', text)
                # Decode HTML entities
                text = html.unescape(text)
                # Collapse whitespace
                text = re.sub(r'\s+', ' ', text).strip()
            elif "json" in content_type:
                text = json.dumps(resp.json(), indent=2)
            else:
                text = resp.text

            truncated = len(text) > max_chars
            return {
                "url": url,
                "content": text[:max_chars],
                "chars_returned": min(len(text), max_chars),
                "truncated": truncated,
                "content_type": content_type,
            }
    except httpx.HTTPStatusError as e:
        return {"error": f"HTTP {e.response.status_code}", "url": url}
    except Exception as exc:
        return {"error": str(exc), "url": url}


# ═══════════════════════════════════════════════════════════════════════════
# AI GENERATION TOOLS
# ═══════════════════════════════════════════════════════════════════════════

@_register(
    "generate_image",
    "Generate an AI image from a text description. Uses HuggingFace FLUX, DALL-E, Gemini, or Pollinations (free fallback). Returns a URL to the generated image.",
    {
        "type": "object",
        "properties": {
            "prompt": {"type": "string", "description": "Detailed description of the image to generate"},
            "width": {"type": "integer", "description": "Image width in pixels (64-1024, default 512)"},
            "height": {"type": "integer", "description": "Image height in pixels (64-1024, default 512)"},
        },
        "required": ["prompt"],
    },
)
async def _generate_image(prompt: str, width: int = 512, height: int = 512, **_) -> dict:
    try:
        from core.config import get_settings
        from services.image_gen import generate as _img_generate
        settings = get_settings()
        result = await _img_generate(
            prompt=prompt,
            width=int(width),
            height=int(height),
            gemini_key=settings.gemini_api_key or "",
            openai_key=settings.openai_api_key or "",
            hf_key=settings.huggingface_api_key or "",
        )
        return {
            "url": result.url,
            "source": result.source,
            "prompt": prompt,
            "width": width,
            "height": height,
        }
    except Exception as exc:
        logger.error("generate_image tool error: %s", exc)
        return {"error": str(exc), "prompt": prompt}


@_register(
    "enhance_prompt",
    "Rewrite a vague or simple image description into a detailed, high-quality image generation prompt with artistic style, lighting, composition, and quality modifiers.",
    {
        "type": "object",
        "properties": {
            "prompt": {"type": "string", "description": "Original vague prompt to enhance"},
            "style": {"type": "string", "description": "Desired style: photorealistic, anime, oil painting, watercolor, digital art, cinematic, sketch (optional)"},
        },
        "required": ["prompt"],
    },
)
async def _enhance_prompt(prompt: str, style: str = "photorealistic", **_) -> dict:
    # Lightweight local enhancement without requiring an API call
    style_modifiers = {
        "photorealistic": "photorealistic, DSLR photo, 8K resolution, sharp focus, professional lighting",
        "anime": "anime style, vibrant colors, cel shading, Studio Ghibli inspired",
        "oil painting": "oil painting, impasto technique, rich textures, gallery quality, renaissance lighting",
        "watercolor": "watercolor painting, soft edges, translucent layers, artistic",
        "digital art": "digital art, concept art, ArtStation trending, highly detailed",
        "cinematic": "cinematic shot, movie still, dramatic lighting, film grain, anamorphic lens",
        "sketch": "pencil sketch, hand-drawn, crosshatching, detailed line art",
    }
    modifier = style_modifiers.get(style.lower(), style_modifiers["photorealistic"])
    enhanced = f"{prompt}, {modifier}, masterpiece, high quality, award-winning"
    return {
        "original_prompt": prompt,
        "enhanced_prompt": enhanced,
        "style": style,
        "tip": "Use the enhanced_prompt with the generate_image tool for best results",
    }


# ═══════════════════════════════════════════════════════════════════════════
# CODE TOOLS
# ═══════════════════════════════════════════════════════════════════════════

@_register(
    "run_code",
    "Execute code and return the output. Supports Python (native subprocess), JavaScript, TypeScript, Go, Rust, Java, C++, C#, Bash (via Judge0 fallback).",
    {
        "type": "object",
        "properties": {
            "code": {"type": "string", "description": "Code to execute"},
            "language": {
                "type": "string",
                "description": "Programming language: python, javascript, typescript, bash, go, rust, java, cpp, csharp, sql",
            },
        },
        "required": ["code", "language"],
    },
)
async def _run_code(code: str, language: str, **_) -> dict:
    language = language.lower().strip()
    if language == "shell":
        language = "bash"

    try:
        if language in ("python", "bash"):
            result = await _exec_subprocess(code, language)
        else:
            result = await _exec_judge0(code, language)
            if result is None:
                result = {"stdout": "", "stderr": f"Language '{language}' execution unavailable.", "status": "Error"}
    except Exception as exc:
        result = {"stdout": "", "stderr": str(exc), "status": "Error"}

    return {
        "language": language,
        "stdout": (result.get("stdout") or "")[:3000],
        "stderr": (result.get("stderr") or "")[:1000],
        "status": result.get("status", "Unknown"),
        "compile_output": (result.get("compile_output") or "")[:500],
    }


async def _exec_subprocess(code: str, language: str) -> dict:
    import asyncio, tempfile, os, sys
    suffix = ".py" if language == "python" else ".sh"
    interpreter = sys.executable if language == "python" else "bash"
    tmp_dir = tempfile.gettempdir()
    with tempfile.NamedTemporaryFile(mode="w", suffix=suffix, delete=False, dir=tmp_dir, encoding="utf-8") as f:
        f.write(code)
        tmp_path = f.name
    env = os.environ.copy()
    env.update({"PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"})
    cmd = [interpreter, "-X", "utf8", tmp_path] if language == "python" else [interpreter, tmp_path]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            cwd=tmp_dir, env=env,
        )
        try:
            stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=10.0)
        except asyncio.TimeoutError:
            try: proc.kill()
            except Exception: pass
            return {"stdout": "", "stderr": "Execution timed out (10s limit).", "status": "Time Limit Exceeded"}
        exit_code = proc.returncode
        return {
            "stdout": stdout_b.decode("utf-8", errors="replace"),
            "stderr": stderr_b.decode("utf-8", errors="replace"),
            "status": "Accepted" if exit_code == 0 else "Runtime Error",
        }
    finally:
        try: os.unlink(tmp_path)
        except OSError: pass


async def _exec_judge0(code: str, language: str) -> dict | None:
    import base64
    LANGUAGE_IDS = {
        "javascript": 63, "typescript": 74, "go": 60, "rust": 73,
        "java": 62, "cpp": 54, "csharp": 51, "sql": 82,
    }
    lang_id = LANGUAGE_IDS.get(language)
    if not lang_id:
        return None
    encoded = base64.b64encode(code.encode()).decode()
    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            submit = await client.post(
                "https://judge0-ce.p.rapidapi.com/submissions",
                params={"base64_encoded": "true", "wait": "false"},
                json={"language_id": lang_id, "source_code": encoded, "cpu_time_limit": 10},
                headers={"Content-Type": "application/json"},
            )
            if not submit.is_success:
                return None
            token = submit.json().get("token")
            if not token:
                return None
            for _ in range(10):
                await asyncio.sleep(2.0)
                result = await client.get(
                    f"https://judge0-ce.p.rapidapi.com/submissions/{token}",
                    params={"base64_encoded": "true"},
                )
                if not result.is_success:
                    continue
                data = result.json()
                if data.get("status", {}).get("id", 0) >= 3:
                    def _b64(v): return base64.b64decode(v).decode("utf-8", errors="replace") if v else ""
                    return {
                        "stdout": _b64(data.get("stdout")),
                        "stderr": _b64(data.get("stderr")),
                        "compile_output": _b64(data.get("compile_output")),
                        "status": data.get("status", {}).get("description", "Unknown"),
                    }
    except Exception:
        pass
    return None


# ═══════════════════════════════════════════════════════════════════════════
# MEMORY / KNOWLEDGE TOOLS
# ═══════════════════════════════════════════════════════════════════════════

@_register(
    "save_memory",
    "Save an important fact or note to the user's session memory so it can be recalled later in the conversation.",
    {
        "type": "object",
        "properties": {
            "user_id": {"type": "string", "description": "User identifier (use 'default' if unknown)"},
            "fact": {"type": "string", "description": "The fact or note to remember"},
            "category": {"type": "string", "description": "Category: preference, task, context, fact (default: fact)"},
        },
        "required": ["fact"],
    },
)
async def _save_memory(fact: str, user_id: str = "default", category: str = "fact", **_) -> dict:
    key = f"{user_id}:{category}"
    if key not in _session_memory:
        _session_memory[key] = []
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    entry = f"[{timestamp}] {fact}"
    _session_memory[key].append(entry)
    # Try to also persist to Firestore
    try:
        from core.firebase import get_firestore
        db = get_firestore()
        db.collection("agent_memory").document(user_id).set(
            {f"facts_{category}": _session_memory[key]}, merge=True
        )
    except Exception:
        pass
    return {"saved": True, "fact": fact, "category": category, "total_in_category": len(_session_memory[key])}


@_register(
    "recall_memory",
    "Retrieve previously saved facts or notes from the user's memory.",
    {
        "type": "object",
        "properties": {
            "user_id": {"type": "string", "description": "User identifier (use 'default' if unknown)"},
            "category": {"type": "string", "description": "Category to recall: preference, task, context, fact, or 'all' for everything"},
        },
        "required": [],
    },
)
async def _recall_memory(user_id: str = "default", category: str = "all", **_) -> dict:
    if category == "all":
        all_facts = []
        for key, facts in _session_memory.items():
            if key.startswith(f"{user_id}:"):
                cat = key.split(":")[1]
                all_facts.extend([f"[{cat}] {f}" for f in facts])
        # Try Firestore too
        try:
            from core.firebase import get_firestore
            db = get_firestore()
            doc = db.collection("agent_memory").document(user_id).get()
            if doc.exists:
                data = doc.to_dict() or {}
                for k, v in data.items():
                    if isinstance(v, list):
                        cat = k.replace("facts_", "")
                        all_facts.extend([f"[{cat}] {f}" for f in v])
        except Exception:
            pass
        return {"user_id": user_id, "facts": list(set(all_facts)), "count": len(set(all_facts))}
    else:
        key = f"{user_id}:{category}"
        facts = _session_memory.get(key, [])
        return {"user_id": user_id, "category": category, "facts": facts, "count": len(facts)}


@_register(
    "list_prompt_templates",
    "List available prompt templates from the user's prompt library. Returns title, description, content, tags, and category.",
    {
        "type": "object",
        "properties": {
            "category": {"type": "string", "description": "Filter by category (optional), e.g. 'code', 'writing', 'research'"},
            "limit": {"type": "integer", "description": "Maximum number of prompts to return (default 10, max 50)"},
        },
        "required": [],
    },
)
async def _list_prompt_templates(category: str = "", limit: int = 10, **_) -> dict:
    limit = max(1, min(50, int(limit)))
    prompts = []
    try:
        from core.firebase import get_firestore
        db = get_firestore()
        query = db.collection("prompts").where("scope", "==", "public").limit(limit)
        docs = query.stream()
        for doc in docs:
            data = doc.to_dict()
            if category and data.get("category", "").lower() != category.lower():
                continue
            prompts.append({
                "id": doc.id,
                "title": data.get("title", ""),
                "description": data.get("description", ""),
                "content": data.get("content", "")[:200] + ("..." if len(data.get("content", "")) > 200 else ""),
                "tags": data.get("tags", []),
                "category": data.get("category", "general"),
                "usage_count": data.get("usageCount", 0),
            })
    except Exception:
        # Firestore unavailable — return built-in defaults
        prompts = [
            {"id": "builtin_1", "title": "Professional Email", "description": "Draft a professional email",
             "content": "Write a professional email about: [topic]. Tone: formal, concise.", "tags": ["email", "writing"], "category": "writing"},
            {"id": "builtin_2", "title": "Code Review", "description": "Thorough code review",
             "content": "Review this code for bugs, performance, security, and style. Be thorough.", "tags": ["code", "review"], "category": "code"},
            {"id": "builtin_3", "title": "Research Summary", "description": "Summarize a topic with sources",
             "content": "Research [topic] and provide a structured summary with key findings.", "tags": ["research"], "category": "research"},
        ]
    return {"prompts": prompts[:limit], "count": len(prompts[:limit]), "filtered_by": category or "none"}


# ═══════════════════════════════════════════════════════════════════════════
# DATA UTILITY TOOLS
# ═══════════════════════════════════════════════════════════════════════════

@_register(
    "summarize_text",
    "Condense long text into key bullet points or a short paragraph. Useful for summarizing articles, documents, or long content.",
    {
        "type": "object",
        "properties": {
            "text": {"type": "string", "description": "Text to summarize (up to 10,000 characters)"},
            "format": {"type": "string", "description": "Output format: bullets (default) or paragraph"},
            "max_points": {"type": "integer", "description": "Maximum number of bullet points (3-10, default 5)"},
        },
        "required": ["text"],
    },
)
async def _summarize_text(text: str, format: str = "bullets", max_points: int = 5, **_) -> dict:
    max_points = max(3, min(10, int(max_points)))
    text = text[:10000]

    # Simple extractive summarization: score sentences by keyword frequency
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 30]

    if not sentences:
        return {"summary": text[:500], "method": "truncation", "original_chars": len(text)}

    # Score by position + length (heuristic)
    scored = []
    words = re.findall(r'\b\w+\b', text.lower())
    freq: dict[str, int] = {}
    for w in words:
        if len(w) > 4:
            freq[w] = freq.get(w, 0) + 1

    for i, sent in enumerate(sentences):
        score = sum(freq.get(w.lower(), 0) for w in re.findall(r'\b\w+\b', sent))
        score += 2 if i < 3 else 0  # Boost early sentences
        score += 1 if i >= len(sentences) - 2 else 0  # Boost conclusion
        scored.append((score, i, sent))

    top = sorted(scored, key=lambda x: -x[0])[:max_points]
    top_sorted = sorted(top, key=lambda x: x[1])  # Restore reading order

    if format == "paragraph":
        summary = " ".join(s for _, _, s in top_sorted)
    else:
        summary = "\n".join(f"• {s}" for _, _, s in top_sorted)

    return {
        "summary": summary,
        "method": "extractive",
        "original_chars": len(text),
        "sentences_extracted": len(top_sorted),
    }


@_register(
    "extract_keywords",
    "Extract the main topics, keywords, and named entities from text.",
    {
        "type": "object",
        "properties": {
            "text": {"type": "string", "description": "Text to analyze"},
            "max_keywords": {"type": "integer", "description": "Maximum keywords to return (5-30, default 15)"},
        },
        "required": ["text"],
    },
)
async def _extract_keywords(text: str, max_keywords: int = 15, **_) -> dict:
    max_keywords = max(5, min(30, int(max_keywords)))
    text = text[:5000]

    stopwords = {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "up", "about", "into", "through", "is",
        "are", "was", "were", "be", "been", "have", "has", "had", "do", "does",
        "did", "will", "would", "could", "should", "may", "might", "that", "this",
        "these", "those", "it", "its", "they", "them", "their", "we", "our",
        "you", "your", "he", "she", "his", "her", "not", "no", "so", "as",
    }

    words = re.findall(r'\b[A-Za-z][a-zA-Z]{2,}\b', text)
    freq: dict[str, int] = {}
    for w in words:
        lw = w.lower()
        if lw not in stopwords:
            freq[lw] = freq.get(lw, 0) + 1

    # Boost capitalized words (likely proper nouns)
    cap_words = re.findall(r'\b[A-Z][a-z]{2,}\b', text)
    for w in cap_words:
        lw = w.lower()
        freq[lw] = freq.get(lw, 0) + 2

    top = sorted(freq.items(), key=lambda x: -x[1])[:max_keywords]

    return {
        "keywords": [{"word": w, "frequency": f} for w, f in top],
        "count": len(top),
        "top_keyword": top[0][0] if top else None,
    }


@_register(
    "format_json",
    "Pretty-print or validate a JSON string. Also supports extracting a specific field by dot-notation path.",
    {
        "type": "object",
        "properties": {
            "json_string": {"type": "string", "description": "JSON string to format or validate"},
            "indent": {"type": "integer", "description": "Indentation spaces (2 or 4, default 2)"},
            "extract_path": {"type": "string", "description": "Dot-notation path to extract, e.g. 'user.name' (optional)"},
        },
        "required": ["json_string"],
    },
)
async def _format_json(json_string: str, indent: int = 2, extract_path: str = "", **_) -> dict:
    try:
        data = json.loads(json_string)
    except json.JSONDecodeError as exc:
        return {"error": f"Invalid JSON: {exc}", "valid": False}

    result = {"valid": True, "type": type(data).__name__}

    if extract_path:
        try:
            val = data
            for key in extract_path.split("."):
                if isinstance(val, dict):
                    val = val[key]
                elif isinstance(val, list) and key.isdigit():
                    val = val[int(key)]
                else:
                    val = None
                    break
            result["extracted"] = val
            result["path"] = extract_path
        except (KeyError, IndexError, TypeError):
            result["extracted"] = None
            result["path_error"] = f"Path '{extract_path}' not found"

    result["formatted"] = json.dumps(data, indent=int(indent), ensure_ascii=False)
    result["minified"] = json.dumps(data, separators=(",", ":"))
    if isinstance(data, (dict, list)):
        result["size"] = len(data) if isinstance(data, list) else len(data.keys())

    return result


# ═══════════════════════════════════════════════════════════════════════════
# PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════

def list_builtin_tools() -> list[dict]:
    """Return manifest: [{name, description, input_schema}] for all tools."""
    return [
        {"name": name, "description": t["description"], "input_schema": t["input_schema"]}
        for name, t in _TOOLS.items()
    ]


def get_tool_names() -> list[str]:
    """Return just the list of tool names."""
    return list(_TOOLS.keys())


async def call_builtin(tool_name: str, arguments: dict) -> dict[str, Any]:
    """Invoke a built-in tool by name and return its result dict."""
    tool = _TOOLS.get(tool_name)
    if not tool:
        return {"error": f"Unknown built-in tool: '{tool_name}'. Available: {', '.join(_TOOLS)}"}
    try:
        return await tool["fn"](**arguments) or {}
    except TypeError as exc:
        return {"error": f"Invalid arguments for '{tool_name}': {exc}"}
    except Exception as exc:
        logger.error("Tool '%s' raised: %s", tool_name, exc, exc_info=True)
        return {"error": str(exc)}
