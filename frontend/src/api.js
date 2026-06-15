// Tiny client for the two backend endpoints. The base URL points at the API,
// which the browser reaches on the published host port (override with
// VITE_API_URL at build time for other setups).

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9000";

async function postJson(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Request to ${path} failed (${response.status})`);
  }
  return response.json();
}

// Ask the concierge for one destination matching the traveller's vibes.
export function suggestDestination({ likes, dislikes, month, exclude }) {
  return postJson("/suggest", { likes, dislikes, month, exclude });
}

// Run the specialists pipeline for a confirmed destination.
export function buildTrip({ destination, month, likes, dislikes }) {
  return postJson("/build-trip", { destination, month, likes, dislikes });
}
