# Travel Concierge — IE MBA Demo

A multi-agent travel recommender, shown in two acts:

- **Act 1 — Behind the scenes:** five agents run one after another in the Agent
  Framework **DevUI**, each calling its own MCP server (flights, weather,
  activities) live.
- **Act 2 — The audience app:** a Tinder-style **swipe** frontend. You swipe on
  travel vibes, the concierge proposes a destination, you swipe to confirm, and
  the specialists build the full trip.

```
trip_concierge ─▶ flights_agent ─▶ weather_agent ─▶ activities_agent ─▶ trip_planner
```

## Project layout

| Folder        | What it is                                                        |
| ------------- | ----------------------------------------------------------------- |
| `mcps/`       | Three FastMCP servers serving mock flight / weather / activity data |
| `backend/`    | The agents, the DevUI app (`main.py`) and the swipe API (`api.py`) |
| `frontend/`   | Vite + React + Motion swipe UI                                    |
| `OLD/`        | The original sample, kept for reference                           |

## Prerequisites

- An Azure AI Foundry deployment, configured in `.env`
  (`FOUNDRY_PROJECT_ENDPOINT`, `FOUNDRY_MODEL_DEPLOYMENT`).
- `az login` on the machine that runs the agents (the API container reuses this
  login by mounting `~/.azure`).
- Docker Desktop.

## Run it

### 1. Start Act 2 (MCP servers + API + frontend)

```bash
docker compose up --build
```

- Swipe app:  http://localhost:5173
- API:        http://localhost:9000  (`/suggest`, `/build-trip`)
- MCP servers: ports 8001 / 8002 / 8003

### 2. Start Act 1 (the DevUI) — on your machine

The DevUI is designed to bind to `localhost`, so run it directly. It reaches the
MCP servers through their published ports:

```bash
pip install -r backend/requirements.txt
python backend/main.py
```

- DevUI: http://localhost:8000

## How Act 2 avoids any "stuck workflow"

The two API endpoints are completely stateless:

- `POST /suggest` runs only the concierge and returns one destination.
- `POST /build-trip` runs the specialists pipeline for a confirmed destination.

The swipe "confirm / reject" is simply the user's finger between those two HTTP
calls — there is no workflow pause to get stuck on.
