"""Weather MCP server.

Exposes a single tool that returns a (mock) weather forecast for a destination.
Data is fake but curated to look realistic for the demo.
"""

import os
import random

from fastmcp import FastMCP

mcp = FastMCP("weather")

CONDITIONS = ["Sunny", "Partly cloudy", "Clear skies", "Warm breeze", "Light rain"]


@mcp.tool
def get_forecast(destination: str, month: str = "July") -> dict:
    """Get a short weather forecast for a destination in a given month.

    Args:
        destination: Destination city or country (e.g. "Lisbon", "Bali").
        month: Travel month (e.g. "July").

    Returns:
        A dictionary with average temperatures and a daily outlook.
    """
    rng = random.Random(f"{destination}-{month}-weather")
    high = rng.randint(24, 34)
    low = high - rng.randint(6, 11)
    return {
        "destination": destination,
        "month": month,
        "avg_high_c": high,
        "avg_low_c": low,
        "condition": rng.choice(CONDITIONS),
        "sea_temp_c": rng.randint(20, 28),
        "advice": "Pack light clothes and sunscreen." if high >= 28 else "Bring a light jacket for the evenings.",
    }


if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=int(os.environ.get("PORT", 8002)))
