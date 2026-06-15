import asyncio
import os

from agent_framework import Agent, AgentResponseUpdate
from agent_framework.foundry import FoundryChatClient
from agent_framework.devui import serve
from agent_framework.observability import create_resource, enable_instrumentation
from agent_framework.orchestrations import SequentialBuilder
from azure.monitor.opentelemetry import configure_azure_monitor  # pip install azure-monitor-opentelemetry
from opentelemetry import trace, metrics                         # opentelemetry-api / opentelemetry-sdk
from azure.identity import AzureCliCredential
from dotenv import load_dotenv

load_dotenv()

configure_azure_monitor(
    connection_string=os.environ["APPLICATIONINSIGHTS_CONNECTION_STRING"],
    resource=create_resource(),
    enable_live_metrics=True,
)  # False for any non-dev environment

enable_instrumentation()

async def main() -> None:
    # 1) Create agents
    client = FoundryChatClient(
        project_endpoint=os.environ["FOUNDRY_PROJECT_ENDPOINT"],
        model=os.environ["FOUNDRY_MODEL"],
        credential=AzureCliCredential(),
    )

    writer = Agent(
        client=client,
        instructions="You are a concise copywriter. Provide a single, punchy marketing sentence based on the prompt.",
        name="writer",
    )

    translator = Agent(
        client=client,
        instructions="You are a translator. Translate the given text into French. Output only the translation.",
        name="translator",
    )

    reviewer = Agent(
        client=client,
        instructions="You are a reviewer. Evaluate the quality of the marketing tagline.",
        name="reviewer",
    )

    # 2) Build sequential workflow: writer -> translator -> reviewer
    #    chain_only_agent_responses=True means each agent sees only the previous agent's reply,
    #    not the full conversation history.
    workflow = SequentialBuilder(
        participants=[writer, translator, reviewer], 
        intermediate_output_from=[translator],
        chain_only_agent_responses=True,
    ).build()

    return workflow


if __name__ == "__main__":
    workflow = asyncio.run(main())
    serve(
        entities=[workflow],
        ui_enabled=True,
        auto_open=True,
        host="localhost",
        port=8000,
        auth_enabled=False,
    )