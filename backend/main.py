"""Acto 1 — DevUI entrypoint.

Serves the travel concierge sequential pipeline in the Agent Framework DevUI so
the audience can watch the five agents run one after another and call their MCP
servers live (concierge -> flights -> weather -> activities -> trip_planner).

The MCP tools are connected once, up front, inside the server's event loop and
kept alive for the whole session. This avoids a cross-task teardown error in the
streamable HTTP client that would otherwise corrupt the agents' output mid-run.

Run (after starting the MCP servers):
    python backend/main.py
"""

import os
from contextlib import AsyncExitStack, asynccontextmanager

import uvicorn
from agent_framework.devui import DevServer
from agent_framework.observability import create_resource, enable_instrumentation
from azure.monitor.opentelemetry import configure_azure_monitor
from dotenv import load_dotenv

from agents import build_workflow, create_mcp_tools

load_dotenv()

if os.environ.get("APPLICATIONINSIGHTS_CONNECTION_STRING"):
    configure_azure_monitor(
        connection_string=os.environ["APPLICATIONINSIGHTS_CONNECTION_STRING"],
        resource=create_resource(),
        enable_live_metrics=True,
    )
    enable_instrumentation()


def main() -> None:
    # Bind to localhost in the devcontainer; set DEVUI_HOST=0.0.0.0 in Docker.
    host = os.environ.get("DEVUI_HOST", "localhost")
    mcp_tools = create_mcp_tools()
    workflow = build_workflow(mcp_tools)

    server = DevServer(host=host, port=8000, ui_enabled=True, auth_enabled=False)
    server.set_pending_entities([workflow])
    app = server.get_app()

    # Wrap DevUI's lifespan so the MCP tools connect first and stay alive for the
    # whole server lifetime (DevUI's own startup then runs inside).
    devui_lifespan = app.router.lifespan_context

    @asynccontextmanager
    async def lifespan(app):
        async with AsyncExitStack() as stack:
            for tool in mcp_tools:
                await stack.enter_async_context(tool)
            async with devui_lifespan(app):
                yield

    app.router.lifespan_context = lifespan

    uvicorn.run(app, host=host, port=8000, log_level="info")


if __name__ == "__main__":
    main()
