"""Candidate simplified Act 1 entrypoint — uses serve() directly."""

import os

from agent_framework.devui import serve
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
    mcp_tools = create_mcp_tools()
    workflow = build_workflow(mcp_tools)
    serve(
        entities=[workflow],
        host="localhost",
        port=8000,
        ui_enabled=True,
        auth_enabled=False,
        auto_open=True,
    )


if __name__ == "__main__":
    main()
