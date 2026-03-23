"""v1 MCP router — /api/v1/mcp/*"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.abac import AbacContext, require_permission
from db.engine import get_db
from db.models.mcp_server import McpServer
from mcp.gateway import get_gateway, McpServerConfig

router = APIRouter(prefix="/mcp", tags=["v1 MCP"])


class McpServerOut(BaseModel):
    id: str
    name: str
    slug: str
    transport: str
    is_active: bool
    health_status: str
    tool_count: int


class McpServerCreateIn(BaseModel):
    name: str
    slug: str
    transport: str = "stdio"
    command: str | None = None
    args: list[str] = []
    url: str | None = None
    env_vars: dict[str, str] = {}
    auth_config: dict = {}


class ToolCallIn(BaseModel):
    tool_name: str
    arguments: dict = {}


@router.get("", response_model=list[McpServerOut])
async def list_mcp_servers(
    ctx: AbacContext = Depends(require_permission("mcp_servers", "read")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(McpServer).where(McpServer.is_active == True))
    servers = result.scalars().all()
    gateway = get_gateway()

    return [
        McpServerOut(
            id=str(s.id),
            name=s.name,
            slug=s.slug,
            transport=s.transport,
            is_active=s.is_active,
            health_status=s.health_status,
            tool_count=len(gateway.list_tools(s.slug)),
        )
        for s in servers
    ]


@router.post("", response_model=McpServerOut, status_code=201)
async def register_mcp_server(
    body: McpServerCreateIn,
    ctx: AbacContext = Depends(require_permission("mcp_servers", "write")),
    db: AsyncSession = Depends(get_db),
):
    server = McpServer(
        id=uuid.uuid4(),
        name=body.name,
        slug=body.slug,
        transport=body.transport,
        command=body.command,
        args=body.args,
        url=body.url,
        env_vars=body.env_vars,
        auth_config=body.auth_config,
        is_active=True,
    )
    db.add(server)
    await db.flush()

    # Register in gateway and attempt connect
    config = McpServerConfig(
        slug=body.slug,
        transport=body.transport,
        command=body.command,
        args=body.args,
        env_vars=body.env_vars,
        url=body.url,
        auth_config=body.auth_config,
    )
    gateway = get_gateway()
    gateway.register(config)
    connected = await gateway.connect(body.slug)
    server.health_status = "healthy" if connected else "unreachable"
    if connected:
        tools = gateway.list_tools(body.slug)
        server.tool_manifest = {t.name: {"description": t.description} for t in tools}
    await db.flush()

    return McpServerOut(
        id=str(server.id), name=server.name, slug=server.slug,
        transport=server.transport, is_active=server.is_active,
        health_status=server.health_status,
        tool_count=len(gateway.list_tools(server.slug)),
    )


@router.get("/{slug}/tools")
async def list_tools(
    slug: str,
    ctx: AbacContext = Depends(require_permission("mcp_servers", "read")),
):
    gateway = get_gateway()
    tools = gateway.list_tools(slug)
    return [
        {"name": t.name, "description": t.description, "input_schema": t.input_schema}
        for t in tools
    ]


@router.post("/{slug}/call")
async def call_tool(
    slug: str,
    body: ToolCallIn,
    ctx: AbacContext = Depends(require_permission("mcp_servers", "read")),
):
    gateway = get_gateway()
    result = await gateway.call_tool(slug, body.tool_name, body.arguments)
    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])
    return result


@router.post("/{slug}/health")
async def health_check(
    slug: str,
    ctx: AbacContext = Depends(require_permission("mcp_servers", "write")),
    db: AsyncSession = Depends(get_db),
):
    gateway = get_gateway()
    healthy = await gateway.health_check(slug)

    # Update DB record
    result = await db.execute(select(McpServer).where(McpServer.slug == slug))
    server = result.scalar_one_or_none()
    if server:
        server.health_status = "healthy" if healthy else "unreachable"
        await db.flush()

    return {"slug": slug, "healthy": healthy}
