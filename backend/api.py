"""Acto 2 — Frontend HTTP API.

Two plain, stateless endpoints power the Tinder-style swipe frontend:

    POST /suggest    -> the concierge picks ONE destination from the traveller's
                        liked / disliked vibes (and a month). Returned as a card
                        the user can swipe right (confirm) or left (reject).

    POST /build-trip -> once a destination is confirmed, the specialists pipeline
                        (flights -> weather -> activities -> trip_planner) gathers
                        everything and returns the final trip plan.

There is no workflow pause or human-in-the-loop here: the "confirm / reject"
decision is simply the user's finger between two independent HTTP calls. This
keeps the backend stateless and avoids the fragile interactive flows.

The MCP tools are connected once at startup and kept alive for the whole server
lifetime (same pattern as Act 1), so no connection happens mid-request.

Run (after starting the MCP servers):
    uvicorn api:app --host 0.0.0.0 --port 9000
"""

from contextlib import AsyncExitStack, asynccontextmanager

from agent_framework import MCPStreamableHTTPTool
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents import (
    build_trip_workflow,
    create_client,
    create_concierge,
    create_mcp_tools,
)

load_dotenv()


# ---- Request / response models -------------------------------------------------


class SuggestRequest(BaseModel):
    likes: list[str] = []
    dislikes: list[str] = []
    month: str = "July"
    exclude: list[str] = []  # destinations the user already rejected


class SuggestResponse(BaseModel):
    destination: str
    reason: str


class BuildTripRequest(BaseModel):
    destination: str
    month: str = "July"
    likes: list[str] = []
    dislikes: list[str] = []


class BuildTripResponse(BaseModel):
    plan: str


# ---- App state: agents + workflow built once at startup ------------------------


class State:
    concierge = None
    trip_workflow = None
    mcp_tools: list[MCPStreamableHTTPTool] = []


state = State()


@asynccontextmanager
async def lifespan(app: FastAPI):
    state.mcp_tools = create_mcp_tools()
    async with AsyncExitStack() as stack:
        for tool in state.mcp_tools:
            await stack.enter_async_context(tool)
        state.concierge = create_concierge(create_client())
        state.trip_workflow = build_trip_workflow(state.mcp_tools)
        yield


app = FastAPI(title="Travel Concierge API", lifespan=lifespan)

# The frontend runs on a different origin (dev server / container), so allow CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _parse_destination(text: str) -> tuple[str, str]:
    """Split the concierge reply into (destination, reason).

    The concierge always answers like 'Destination: Ibiza, Spain. <why>'. If the
    marker is missing we fall back to the whole text as the destination.
    """
    marker = "Destination:"
    if marker in text:
        after = text.split(marker, 1)[1].strip()
        # Destination is up to the first period; the rest is the reason.
        destination, _, reason = after.partition(".")
        return destination.strip(), reason.strip()
    return text.strip(), ""


# ---- Endpoints -----------------------------------------------------------------


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/suggest", response_model=SuggestResponse)
async def suggest(req: SuggestRequest) -> SuggestResponse:
    """Ask the concierge for ONE destination matching the traveller's vibes."""
    likes = ", ".join(req.likes) or "anything fun"
    dislikes = ", ".join(req.dislikes) or "nothing in particular"
    message = (
        f"I like: {likes}. I dislike: {dislikes}. "
        f"I want to travel in {req.month}."
    )
    if req.exclude:
        message += f" Do not suggest these places: {', '.join(req.exclude)}."

    response = await state.concierge.run(message)
    destination, reason = _parse_destination(response.text)
    return SuggestResponse(destination=destination, reason=reason)


@app.post("/build-trip", response_model=BuildTripResponse)
async def build_trip(req: BuildTripRequest) -> BuildTripResponse:
    """Run the specialists pipeline for a confirmed destination."""
    likes = ", ".join(req.likes) or "anything fun"
    dislikes = ", ".join(req.dislikes) or "nothing in particular"
    message = (
        f"Destination: {req.destination}. Travel month: {req.month}. "
        f"Departure: Madrid. Traveller likes: {likes}. Dislikes: {dislikes}."
    )

    result = await state.trip_workflow.run(message)
    outputs = result.get_outputs()
    plan = str(outputs[-1]) if outputs else "Sorry, I could not build a plan."
    return BuildTripResponse(plan=plan)
