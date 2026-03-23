"""
Model routing profiles — maps intent profiles to concrete model IDs.

Profiles:
  reasoning  → claude-opus-4-6     (complex tasks, research, code review)
  daily      → claude-sonnet-4-6   (default chat, drafting, Q&A)
  realtime   → claude-haiku-4-5-20251001  (fast responses, autocomplete)
  vision     → claude-sonnet-4-6   (image understanding)
  image      → stability-ai/stable-diffusion-3 (image generation via OpenRouter)

Usage:
    from sessions.routing import resolve_model

    model_id = resolve_model("reasoning")  # -> "claude-opus-4-6"
"""
from __future__ import annotations

import os

# Default model IDs (can be overridden via env vars)
_PROFILES: dict[str, str] = {
    "reasoning": os.getenv("MODEL_REASONING", "claude-opus-4-6"),
    "daily":     os.getenv("MODEL_DAILY",     "claude-sonnet-4-6"),
    "realtime":  os.getenv("MODEL_REALTIME",  "claude-haiku-4-5-20251001"),
    "vision":    os.getenv("MODEL_VISION",    "claude-sonnet-4-6"),
    "image":     os.getenv("MODEL_IMAGE",     "stability-ai/stable-diffusion-3"),
}

# Token budgets per profile (max completion tokens)
_BUDGETS: dict[str, int] = {
    "reasoning": 16_384,
    "daily":      8_192,
    "realtime":   2_048,
    "vision":     4_096,
    "image":        256,  # prompt refinement only
}

# Temperature defaults
_TEMPERATURES: dict[str, float] = {
    "reasoning": 0.3,
    "daily":     0.7,
    "realtime":  0.5,
    "vision":    0.4,
    "image":     0.9,
}


def resolve_model(profile: str) -> str:
    """Return the model ID for a routing profile (falls back to daily)."""
    return _PROFILES.get(profile, _PROFILES["daily"])


def resolve_budget(profile: str) -> int:
    """Return the max_tokens budget for a routing profile."""
    return _BUDGETS.get(profile, _BUDGETS["daily"])


def resolve_temperature(profile: str) -> float:
    """Return the default temperature for a routing profile."""
    return _TEMPERATURES.get(profile, _TEMPERATURES["daily"])


def infer_profile(modality: str, content: str = "") -> str:
    """
    Heuristically infer the best routing profile from modality and content.

    Rules:
    - image modality → image profile
    - voice modality → realtime profile
    - agentic modality or content mentions deep research/code review → reasoning
    - default → daily
    """
    modality = modality.lower()
    if modality == "image":
        return "image"
    if modality == "voice":
        return "realtime"
    if modality == "agentic":
        return "reasoning"

    # Keyword-based escalation to reasoning
    reasoning_keywords = [
        "analyze", "research", "compare", "architecture", "review code",
        "debug", "optimize", "explain in depth", "step by step", "pros and cons",
    ]
    content_lower = content.lower()
    if any(kw in content_lower for kw in reasoning_keywords):
        return "reasoning"

    return "daily"


def get_all_profiles() -> dict[str, dict]:
    """Return all profile configurations (for API introspection)."""
    return {
        name: {
            "model_id": _PROFILES[name],
            "max_tokens": _BUDGETS[name],
            "temperature": _TEMPERATURES[name],
        }
        for name in _PROFILES
    }
