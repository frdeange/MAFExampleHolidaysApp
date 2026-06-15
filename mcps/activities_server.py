"""Activities MCP server.

Exposes a single tool that returns (mock) activities for a destination,
optionally tailored to the traveller's vibes (e.g. "beach", "nightlife", "hiking").
Data is fake but curated to look realistic for the demo.
"""

import os
import random

from fastmcp import FastMCP

mcp = FastMCP("activities")

# Curated pool of activities tagged by vibe so results feel tailored.
ACTIVITY_POOL = [
    {"name": "Sunset catamaran cruise", "vibe": "beach", "duration_h": 3, "price_eur": 45},
    {"name": "Snorkeling at a hidden cove", "vibe": "beach", "duration_h": 4, "price_eur": 35},
    {"name": "Old town tapas & wine crawl", "vibe": "nightlife", "duration_h": 3, "price_eur": 55},
    {"name": "Rooftop bars night tour", "vibe": "nightlife", "duration_h": 4, "price_eur": 40},
    {"name": "Sunrise summit hike", "vibe": "hiking", "duration_h": 6, "price_eur": 30},
    {"name": "Waterfall trail trek", "vibe": "hiking", "duration_h": 5, "price_eur": 25},
    {"name": "Local cooking masterclass", "vibe": "food", "duration_h": 3, "price_eur": 60},
    {"name": "Street food market tour", "vibe": "food", "duration_h": 2, "price_eur": 30},
    {"name": "Historic landmarks walking tour", "vibe": "culture", "duration_h": 3, "price_eur": 20},
    {"name": "Art & design museum pass", "vibe": "culture", "duration_h": 4, "price_eur": 28},
]


@mcp.tool
def find_activities(destination: str, vibes: str = "") -> dict:
    """Find recommended activities for a destination, tailored to traveller vibes.

    Args:
        destination: Destination city or country (e.g. "Lisbon", "Bali").
        vibes: Comma-separated interests (e.g. "beach, nightlife, food").

    Returns:
        A dictionary with a curated list of activity recommendations.
    """
    wanted = {v.strip().lower() for v in vibes.split(",") if v.strip()}
    matches = [a for a in ACTIVITY_POOL if a["vibe"] in wanted] if wanted else list(ACTIVITY_POOL)
    if not matches:
        matches = list(ACTIVITY_POOL)

    rng = random.Random(f"{destination}-{vibes}")
    rng.shuffle(matches)
    return {
        "destination": destination,
        "vibes": sorted(wanted),
        "activities": matches[:4],
    }


if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=int(os.environ.get("PORT", 8003)))
