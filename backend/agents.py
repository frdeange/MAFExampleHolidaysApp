"""Travel concierge agents and the sequential trip-planning pipeline.

Five agents run one after another in a clean linear chain:

    trip_concierge ─▶ flights_agent ─▶ weather_agent ─▶ activities_agent ─▶ trip_planner

The concierge reads the traveller's vibes and picks ONE destination. Each
specialist then reads the conversation, calls its own MCP server (mock data) and
adds a short summary. The trip_planner assembles everything into a final plan.

There is no human-in-the-loop pause here: the whole pipeline runs end to end so
the Dev UI (Act 1) shows a clear, deterministic flow. The interactive
"confirm / reject destination" step lives in the Act 2 frontend, which calls the
backend in two plain steps (suggest a destination, then build the trip).
"""

import os

from agent_framework import (
    Agent,
    AgentExecutorRequest,
    AgentExecutorResponse,
    Executor,
    MCPStreamableHTTPTool,
    WorkflowBuilder,
    WorkflowContext,
    handler,
)
from agent_framework._workflows._message_utils import normalize_messages_input
from agent_framework.foundry import FoundryChatClient
from agent_framework.orchestrations import SequentialBuilder
from azure.identity import AzureCliCredential
from dotenv import load_dotenv

load_dotenv()


# MCP server URLs (overridable via env so docker-compose can use service names).
FLIGHTS_MCP_URL = os.environ.get("FLIGHTS_MCP_URL", "http://localhost:8001/mcp")
WEATHER_MCP_URL = os.environ.get("WEATHER_MCP_URL", "http://localhost:8002/mcp")
ACTIVITIES_MCP_URL = os.environ.get("ACTIVITIES_MCP_URL", "http://localhost:8003/mcp")


def create_client() -> FoundryChatClient:
    """Create the Azure AI Foundry chat client shared by all agents."""
    return FoundryChatClient(
        project_endpoint=os.environ["FOUNDRY_PROJECT_ENDPOINT"],
        model=os.environ["FOUNDRY_MODEL_DEPLOYMENT"],
        credential=AzureCliCredential(),
    )


def create_mcp_tools() -> list[MCPStreamableHTTPTool]:
    """Create the three MCP tools (flights, weather, activities).

    Returned so the caller can pre-connect them once with an AsyncExitStack and
    keep them alive for the whole server lifetime. Connecting them up front (and
    never mid-run) avoids a cross-task teardown error in the streamable HTTP
    client that otherwise corrupts the agents' output mid-pipeline.
    """
    return [
        MCPStreamableHTTPTool(name="flights", url=FLIGHTS_MCP_URL),
        MCPStreamableHTTPTool(name="weather", url=WEATHER_MCP_URL),
        MCPStreamableHTTPTool(name="activities", url=ACTIVITIES_MCP_URL),
    ]


def create_concierge(client: FoundryChatClient) -> Agent:
    """Create the concierge agent that picks a destination from the user's vibes."""
    return Agent(
        client=client,
        name="trip_concierge",
        instructions=(
            "You are a friendly travel concierge. The user shares their travel vibes "
            "(things they like and dislike, e.g. beaches, nightlife, hiking, museums) "
            "and a travel month.\n"
            "Pick ONE concrete destination (a city or region) that best matches those "
            "vibes and state it clearly, e.g. 'Destination: Ibiza, Spain.' Then add one "
            "short sentence explaining why it fits. Assume departure from Madrid.\n"
            "Do NOT ask the user any questions and do NOT ask for departure city, dates "
            "or budget. Keep it upbeat and concise."
        ),
    )


def create_specialists(
    client: FoundryChatClient,
    flights_mcp: MCPStreamableHTTPTool,
    weather_mcp: MCPStreamableHTTPTool,
    activities_mcp: MCPStreamableHTTPTool,
) -> tuple[Agent, Agent, Agent, Agent]:
    """Create the three specialists and the final trip planner.

    The MCP tools are passed in (instead of created here) so the caller can
    pre-connect them once and keep them alive for the whole pipeline lifetime.

    Returns:
        Tuple of (flights_agent, weather_agent, activities_agent, trip_planner).
    """
    flights_agent = Agent(
        client=client,
        name="flights_agent",
        instructions=(
            "You find flight options. Read the destination and travel month chosen "
            "earlier in the conversation and call your flight search tool for them "
            "(departure is always Madrid). Briefly summarize the best options. Never ask "
            "the user for more information."
        ),
        tools=flights_mcp,
    )

    weather_agent = Agent(
        client=client,
        name="weather_agent",
        instructions=(
            "You report the weather outlook. Read the destination and travel month from "
            "the conversation and call your forecast tool for them. Summarize the outlook "
            "in one or two sentences. Never ask the user for more information."
        ),
        tools=weather_mcp,
    )

    activities_agent = Agent(
        client=client,
        name="activities_agent",
        instructions=(
            "You recommend activities. Read the destination and the traveller's vibes "
            "from the conversation and call your activities tool, tailored to those "
            "vibes. List a few highlights. Never ask the user for more information."
        ),
        tools=activities_mcp,
    )

    trip_planner = Agent(
        client=client,
        name="trip_planner",
        instructions=(
            "You assemble the FINAL trip plan. Everything you need is ALREADY in the "
            "conversation above: the chosen destination, the travel month, and the "
            "flights, weather and activities the specialists just gathered (departure is "
            "always Madrid). Use only that information. NEVER say any information is "
            "missing and NEVER ask the user for anything. Do NOT call any tool.\n\n"
            "Output GitHub Markdown with EXACTLY these three sections, in this order, and "
            "NOTHING else — no title, no intro or closing text, no extra sections, no "
            "horizontal rules, no sub-headings:\n\n"
            "## Flights\n"
            "A bullet list of up to 3 options. Each option MUST be a single line with "
            "this exact shape (parts separated by an em dash ' — '):\n"
            "- <Airline> — €<price> — <Nonstop or 1 stop or 2 stops> — ~<hours>h — <Class>\n\n"
            "## Weather\n"
            "A bullet list, one item per line, label then value:\n"
            "- High: ~<NN>°C\n"
            "- Low: ~<NN>°C\n"
            "- Conditions: <short text>\n"
            "- Sea: ~<NN>°C\n"
            "- Packing: <short tip>\n\n"
            "## Activities\n"
            "A bullet list of 3 to 5 activities matched to the traveller's likes. Each:\n"
            "- <Activity name> (≈<duration>, €<cost>)\n\n"
            "Keep every line concise. Use only plain bullet lists under each heading."
        ),
    )

    return flights_agent, weather_agent, activities_agent, trip_planner


def build_workflow(mcp_tools: list[MCPStreamableHTTPTool]):
    """Build the end-to-end sequential pipeline (Act 1, Dev UI).

    Linear chain, each agent runs once after the previous one:

        concierge ─▶ flights ─▶ weather ─▶ activities ─▶ trip_planner

    No human-in-the-loop and no checkpointing, so the Dev UI shows a clean,
    deterministic flow that lights up step by step.

    Args:
        mcp_tools: The [flights, weather, activities] MCP tools, already created
            via create_mcp_tools(). The caller is responsible for connecting them.
    """
    client = create_client()
    flights_mcp, weather_mcp, activities_mcp = mcp_tools
    concierge = create_concierge(client)
    flights, weather, activities, planner = create_specialists(
        client, flights_mcp, weather_mcp, activities_mcp
    )

    workflow = SequentialBuilder(
        participants=[concierge, flights, weather, activities, planner],
    ).build()
    workflow.name = "Travel Concierge"
    return workflow


def build_trip_workflow(mcp_tools: list[MCPStreamableHTTPTool]):
    """Build the specialists-only pipeline (Act 2, frontend API).

    Linear chain WITHOUT the concierge, because in Act 2 the destination has
    already been confirmed by the user's swipe:

        flights ─▶ weather ─▶ activities ─▶ trip_planner

    The caller passes an opening message stating the chosen destination and
    month, so each specialist can read it from the conversation.

    Args:
        mcp_tools: The [flights, weather, activities] MCP tools, already created
            via create_mcp_tools(). The caller is responsible for connecting them.
    """
    client = create_client()
    flights_mcp, weather_mcp, activities_mcp = mcp_tools
    flights, weather, activities, planner = create_specialists(
        client, flights_mcp, weather_mcp, activities_mcp
    )

    workflow = SequentialBuilder(
        participants=[flights, weather, activities, planner],
    ).build()
    workflow.name = "Trip Builder"
    return workflow


class _GatherForPlanner(Executor):
    """Fan-in node that merges the three specialists' summaries for the planner.

    In the parallel workflow the flights, weather and activities agents run at the
    same time, so they each finish with their own separate reply. This executor
    waits for all three (fan-in), then hands the trip_planner a single clean prompt
    containing the original request, the chosen destination and the three
    summaries — so the planner sees exactly the same information it would have seen
    in the sequential chain.

    Only assistant text is forwarded (no raw tool-call messages), which keeps the
    planner's input simple and deterministic.
    """

    @handler
    async def gather(
        self,
        results: list[AgentExecutorResponse],
        ctx: WorkflowContext[AgentExecutorRequest],
    ) -> None:
        # All three specialists branched from the concierge, so any of their
        # conversations contains the shared prefix: the traveller request (user)
        # and the concierge's destination pick (first assistant message).
        prefix = results[0].full_conversation
        traveller = next((m.text for m in prefix if str(m.role) == "user" and m.text), "")
        destination = next((m.text for m in prefix if str(m.role) == "assistant" and m.text), "")

        lines = []
        if traveller:
            lines.append(f"Traveller request: {traveller}")
        if destination:
            lines.append(destination)
        for r in results:
            summary = r.agent_response.text.strip()
            if summary:
                lines.append(summary)

        prompt = "\n\n".join(lines)
        await ctx.send_message(
            AgentExecutorRequest(messages=normalize_messages_input(prompt), should_respond=True)
        )


def build_parallel_workflow(mcp_tools: list[MCPStreamableHTTPTool]):
    """Build the PARALLEL pipeline variant (Act 1, Dev UI).

    Same agents as the sequential workflow, but the three specialists run at the
    same time instead of one after another, because they all need only the chosen
    destination — none of them depends on another's output:

                       ┌─▶ flights ─┐
        concierge ─────┼─▶ weather ─┼─▶ gather ─▶ trip_planner
                       └─▶ activities ┘

    The concierge picks a destination, fans it out to all three specialists at
    once, a small gather node waits for all of them and merges their summaries,
    and the trip_planner writes the final plan. This is faster than the sequential
    chain (the specialists overlap) while producing the same final output.

    Args:
        mcp_tools: The [flights, weather, activities] MCP tools, already created
            via create_mcp_tools(). The caller is responsible for connecting them.
    """
    client = create_client()
    flights_mcp, weather_mcp, activities_mcp = mcp_tools
    concierge = create_concierge(client)
    flights, weather, activities, planner = create_specialists(
        client, flights_mcp, weather_mcp, activities_mcp
    )
    gather = _GatherForPlanner(id="gather")

    workflow = (
        WorkflowBuilder(start_executor=concierge, output_from=[planner])
        .add_fan_out_edges(concierge, [flights, weather, activities])
        .add_fan_in_edges([flights, weather, activities], gather)
        .add_edge(gather, planner)
        .build()
    )
    workflow.name = "Travel Concierge (Parallel)"
    return workflow
