"""Acto 1 — DevUI entrypoint.

Serves the travel concierge sequential pipeline in the Agent Framework DevUI so
the audience can watch the five agents run one after another and call their MCP
servers live (concierge -> flights -> weather -> activities -> trip_planner).

Each agent connects its own MCP tools on first run and the DevUI keeps them alive
for the session, so no manual wiring is needed: serve() handles the whole server
lifecycle (entity registration, startup and cleanup).

Run (after starting the MCP servers):
    python backend/main.py
"""

import os

from agent_framework.devui import serve
from agent_framework.observability import create_resource, enable_instrumentation
from azure.monitor.opentelemetry import configure_azure_monitor
from dotenv import load_dotenv

from agents import build_parallel_workflow, build_workflow, create_mcp_tools

load_dotenv()

if os.environ.get("APPLICATIONINSIGHTS_CONNECTION_STRING"):
    configure_azure_monitor(
        connection_string=os.environ["APPLICATIONINSIGHTS_CONNECTION_STRING"],
        resource=create_resource(),
        enable_live_metrics=True,
    )
    enable_instrumentation()


def main() -> None:
    sequential = build_workflow(create_mcp_tools())
    parallel = build_parallel_workflow(create_mcp_tools())
    serve(
        entities=[sequential, parallel],
        host="localhost",
        port=8000,
        ui_enabled=True,
        auth_enabled=False,
        auto_open=True,
    )


if __name__ == "__main__":
    main()
