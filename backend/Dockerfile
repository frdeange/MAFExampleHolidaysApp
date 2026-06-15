# Image for both Act 1 (DevUI, main.py) and Act 2 (API, api.py).
# Includes the Azure CLI so AzureCliCredential can reuse the login token cache
# mounted from the host (~/.azure) — no separate service principal needed.
FROM python:3.13-slim

WORKDIR /app

# Azure CLI (Debian install script) for AzureCliCredential.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -sL https://aka.ms/InstallAzureCLIDeb | bash \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Default to Act 1 DevUI; the API service overrides the command in compose.
CMD ["python", "main.py"]
