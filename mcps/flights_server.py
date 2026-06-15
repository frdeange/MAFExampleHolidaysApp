"""Flights MCP server.

Exposes a single tool that returns (mock) flight options for a destination.
Data is fake but curated to look realistic for the demo.
"""

import os
import random

from fastmcp import FastMCP

mcp = FastMCP("flights")

AIRLINES = ["Iberia", "Lufthansa", "Air France", "KLM", "TAP", "Vueling", "Ryanair"]

# A small curated map of "home base" airports just to make output look real.
ORIGIN_AIRPORT = {"code": "MAD", "city": "Madrid"}


@mcp.tool
def search_flights(destination: str, month: str = "July") -> dict:
    """Search round-trip flight options to a destination for a given month.

    Args:
        destination: Destination city or country (e.g. "Lisbon", "Bali").
        month: Travel month (e.g. "July").

    Returns:
        A dictionary with the origin and a list of flight options.
    """
    rng = random.Random(f"{destination}-{month}")
    options = []
    for _ in range(3):
        price = rng.randint(120, 850)
        stops = rng.choice([0, 0, 1])
        hours = rng.randint(2, 14) + (3 if stops else 0)
        options.append(
            {
                "airline": rng.choice(AIRLINES),
                "price_eur": price,
                "stops": stops,
                "duration_hours": hours,
                "cabin": "Economy",
            }
        )
    options.sort(key=lambda o: o["price_eur"])
    return {
        "origin": ORIGIN_AIRPORT,
        "destination": destination,
        "month": month,
        "options": options,
    }


if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=int(os.environ.get("PORT", 8001)))
