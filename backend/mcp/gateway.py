"""
MCP Gateway — manages connections to MCP tool servers.

Supports three transports:
  - stdio:           local subprocess (command + args)
  - streamable_http: network MCP server (HTTP POST + SSE)
  - sse:             legacy SSE-only transport

Usage:
    from mcp.gateway import get_gateway

    gateway = get_gateway()
    tools = await gateway.list_tools(server_slug)
    result = await gateway.call_tool(server_slug, tool_name, arguments)
"""
from __future__ import annotations

import asyncio
import json
import logging
import subprocess
import uuid
from dataclasses import dataclass, field
from typing import Any

import httpx

logger = logging.getLogger(__name__)


# ── Data structures ───────────────────────────────────────────────────
@dataclass
class McpTool:
    name: str
    description: str
    input_schema: dict = field(default_factory=dict)


@dataclass
class McpServerConfig:
    slug: str
    transport: str          # stdio | streamable_http | sse
    command: str | None = None
    args: list[str] = field(default_factory=list)
    env_vars: dict[str, str] = field(default_factory=dict)
    url: str | None = None
    auth_config: dict = field(default_factory=dict)


@dataclass
class McpConnection:
    config: McpServerConfig
    tools: list[McpTool] = field(default_factory=list)
    healthy: bool = False
    process: Any = None  # subprocess.Popen for stdio


# ── Gateway ───────────────────────────────────────────────────────────
class McpGateway:
    """Central registry and dispatcher for MCP server connections."""

    def __init__(self) -> None:
        self._connections: dict[str, McpConnection] = {}
        self._http = httpx.AsyncClient(timeout=30.0)

    # ── Registration ─────────────────────────────────────────────────
    def register(self, config: McpServerConfig) -> None:
        self._connections[config.slug] = McpConnection(config=config)

    def unregister(self, slug: str) -> None:
        conn = self._connections.pop(slug, None)
        if conn and conn.process:
            try:
                conn.process.terminate()
            except Exception:
                pass

    # ── Health + tool discovery ───────────────────────────────────────
    async def connect(self, slug: str) -> bool:
        """Connect to a server and fetch its tool manifest."""
        conn = self._connections.get(slug)
        if not conn:
            logger.warning("MCP server not registered: %s", slug)
            return False

        transport = conn.config.transport
        try:
            if transport == "builtin":
                from mcp.builtin_tools import list_builtin_tools
                conn.tools = [
                    McpTool(name=t["name"], description=t["description"], input_schema=t["input_schema"])
                    for t in list_builtin_tools()
                ]
                conn.healthy = True
                logger.info("MCP builtin server connected (%d tools)", len(conn.tools))
                return True
            elif transport == "stdio":
                tools = await self._stdio_list_tools(conn)
            elif transport in ("streamable_http", "sse"):
                tools = await self._http_list_tools(conn)
            else:
                logger.error("Unknown MCP transport: %s", transport)
                return False

            conn.tools = tools
            conn.healthy = True
            logger.info("MCP server connected: %s (%d tools)", slug, len(tools))
            return True
        except Exception as exc:
            conn.healthy = False
            logger.warning("MCP server %s connect failed: %s", slug, exc)
            return False

    async def connect_all(self) -> dict[str, bool]:
        """Connect to all registered servers concurrently."""
        results = await asyncio.gather(
            *[self.connect(slug) for slug in self._connections],
            return_exceptions=True,
        )
        return {slug: bool(r) for slug, r in zip(self._connections, results)}

    async def health_check(self, slug: str) -> bool:
        """Re-ping a server and update health status."""
        return await self.connect(slug)

    # ── Tool listing ─────────────────────────────────────────────────
    def list_tools(self, slug: str) -> list[McpTool]:
        """Return cached tool list for a server."""
        conn = self._connections.get(slug)
        return conn.tools if conn else []

    def list_all_tools(self) -> dict[str, list[McpTool]]:
        """Return all tools grouped by server slug."""
        return {slug: conn.tools for slug, conn in self._connections.items() if conn.healthy}

    # ── Tool calling ─────────────────────────────────────────────────
    async def call_tool(
        self, slug: str, tool_name: str, arguments: dict
    ) -> dict:
        """Invoke a tool on an MCP server and return the result."""
        conn = self._connections.get(slug)
        if not conn:
            return {"error": f"Server not found: {slug}"}
        if not conn.healthy:
            return {"error": f"Server unhealthy: {slug}"}

        transport = conn.config.transport
        try:
            if transport == "builtin":
                from mcp.builtin_tools import call_builtin
                return await call_builtin(tool_name, arguments)
            elif transport == "stdio":
                return await self._stdio_call_tool(conn, tool_name, arguments)
            elif transport in ("streamable_http", "sse"):
                return await self._http_call_tool(conn, tool_name, arguments)
            else:
                return {"error": f"Unknown transport: {transport}"}
        except Exception as exc:
            logger.error("MCP tool call failed %s/%s: %s", slug, tool_name, exc)
            return {"error": str(exc)}

    # ── stdio transport ───────────────────────────────────────────────
    async def _stdio_send_request(self, conn: McpConnection, method: str, params: dict) -> dict:
        """Send a JSON-RPC request to a stdio MCP server process."""
        import os

        if conn.process is None or conn.process.poll() is not None:
            # Start the subprocess
            env = {**os.environ, **conn.config.env_vars}
            cmd = [conn.config.command] + (conn.config.args or [])
            conn.process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
                text=True,
            )

        request = json.dumps({
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": method,
            "params": params,
        }) + "\n"

        loop = asyncio.get_event_loop()
        # Run blocking stdin/stdout I/O in executor
        def _write_read():
            conn.process.stdin.write(request)
            conn.process.stdin.flush()
            line = conn.process.stdout.readline()
            return json.loads(line) if line else {}

        response = await loop.run_in_executor(None, _write_read)
        return response.get("result", {})

    async def _stdio_list_tools(self, conn: McpConnection) -> list[McpTool]:
        result = await self._stdio_send_request(conn, "tools/list", {})
        return [
            McpTool(
                name=t["name"],
                description=t.get("description", ""),
                input_schema=t.get("inputSchema", {}),
            )
            for t in result.get("tools", [])
        ]

    async def _stdio_call_tool(self, conn: McpConnection, name: str, arguments: dict) -> dict:
        return await self._stdio_send_request(
            conn, "tools/call", {"name": name, "arguments": arguments}
        )

    # ── HTTP / SSE transport ──────────────────────────────────────────
    def _auth_headers(self, conn: McpConnection) -> dict[str, str]:
        auth = conn.config.auth_config
        if not auth or auth.get("type") == "none":
            return {}
        if auth.get("type") == "bearer":
            import os
            token_var = auth.get("token_env_var", "MCP_TOKEN")
            token = os.environ.get(token_var, "")
            return {"Authorization": f"Bearer {token}"}
        return {}

    async def _http_list_tools(self, conn: McpConnection) -> list[McpTool]:
        url = f"{conn.config.url}/tools/list"
        headers = self._auth_headers(conn)
        resp = await self._http.post(url, json={
            "jsonrpc": "2.0", "id": "1", "method": "tools/list", "params": {}
        }, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        tools_data = data.get("result", {}).get("tools", [])
        return [
            McpTool(
                name=t["name"],
                description=t.get("description", ""),
                input_schema=t.get("inputSchema", {}),
            )
            for t in tools_data
        ]

    async def _http_call_tool(self, conn: McpConnection, name: str, arguments: dict) -> dict:
        url = f"{conn.config.url}/tools/call"
        headers = self._auth_headers(conn)
        resp = await self._http.post(url, json={
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments},
        }, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data.get("result", {})

    async def close(self) -> None:
        """Terminate all subprocess connections and close HTTP client."""
        for conn in self._connections.values():
            if conn.process:
                try:
                    conn.process.terminate()
                except Exception:
                    pass
        await self._http.aclose()


# ── Singleton ─────────────────────────────────────────────────────────
_gateway: McpGateway | None = None


def get_gateway() -> McpGateway:
    global _gateway
    if _gateway is None:
        _gateway = McpGateway()
    return _gateway


async def close_gateway() -> None:
    global _gateway
    if _gateway is not None:
        await _gateway.close()
        _gateway = None
