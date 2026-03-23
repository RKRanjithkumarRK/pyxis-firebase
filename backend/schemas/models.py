"""
Pydantic schemas — all request/response models for the API.
"""

from typing import Any
from pydantic import BaseModel


# ── Chat ──────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str           # "user" | "assistant" | "system"
    content: str


class ChatRequest(BaseModel):
    message: str
    model: str = "gemini-2.5-flash"
    conversationId: str | None = None
    history: list[ChatMessage] = []
    systemPrompt: str | None = None


# ── Images ────────────────────────────────────────────────────────────

class ImageRequest(BaseModel):
    prompt: str
    width: int = 1024
    height: int = 1024


class ImageResponse(BaseModel):
    url: str
    prompt: str
    source: str


# ── Messages ──────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    conversationId: str
    role: str
    content: str
    imageUrl: str | None = None


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    imageUrl: str | None = None
    createdAt: Any = None


# ── Conversations ────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    title: str = "New Conversation"
    model: str = "gemini-2.5-flash"
    projectId: str | None = None


class ConversationUpdate(BaseModel):
    title: str | None = None
    archived: bool | None = None


class ConversationResponse(BaseModel):
    id: str
    title: str
    model: str
    createdAt: Any = None
    updatedAt: Any = None
    archived: bool = False
    projectId: str | None = None


# ── Projects ──────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    tags: list[str] = []


class ProjectUpdate(BaseModel):
    name: str | None = None
    tags: list[str] | None = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    tags: list[str] = []
    createdAt: Any = None
    updatedAt: Any = None


# ── API Keys ──────────────────────────────────────────────────────────

class KeySave(BaseModel):
    provider: str   # "openrouter" | "openai" | "huggingface"
    key: str


class KeyDeleteRequest(BaseModel):
    provider: str


# ── Profile / Settings ────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    section: str = "general"
    data: dict[str, Any]


# ── Voice ─────────────────────────────────────────────────────────────

class VoiceRequest(BaseModel):
    message: str
    model: str = "gemini-2.5-flash"


# ── Transcribe ────────────────────────────────────────────────────────

class TranscribeRequest(BaseModel):
    audio: str      # base64 encoded audio
    mimeType: str = "audio/webm"


# ── Code Run ──────────────────────────────────────────────────────────

class RunRequest(BaseModel):
    code: str
    language: str = "python"    # "python" | "typescript" | "bash"


class RunResponse(BaseModel):
    stdout: str = ""
    stderr: str = ""
    compile_output: str = ""
    status: str = ""
    message: str = ""   # extra info (e.g. "not configured" guidance)


# ── Search ────────────────────────────────────────────────────────────

class SearchResult(BaseModel):
    title: str
    snippet: str
    url: str


# ── Guest ─────────────────────────────────────────────────────────────

class GuestResponse(BaseModel):
    token: str
    uid: str


# ── Prompts ──────────────────────────────────────────────────────────

class PromptCreate(BaseModel):
    title: str
    content: str
    description: str = ""
    tags: list[str] = []
    scope: str = "personal"   # personal | public
    category: str = "general"

class PromptResponse(BaseModel):
    id: str
    title: str
    content: str
    description: str = ""
    tags: list[str] = []
    scope: str = "personal"
    category: str = "general"
    userId: str = ""
    usageCount: int = 0
    createdAt: Any = None
    updatedAt: Any = None
