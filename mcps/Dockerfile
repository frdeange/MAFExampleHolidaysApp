# Shared image for the three MCP servers (flights, weather, activities).
# The actual server to run is chosen per-service via the command in compose.
FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Default; overridden per service in docker-compose.yml.
CMD ["python", "flights_server.py"]
