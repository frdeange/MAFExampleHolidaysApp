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

// Fetch a real photo of the destination from Wikipedia's public API (CORS-enabled
// via origin=*). The destination string may be "Tenerife, Spain" — we use the
// part before the comma as the article title and follow redirects. Returns an
// 800px image URL, or null if none is found (caller falls back to a local image).
export async function fetchDestinationPhoto(name) {
  if (!name) return null;
  // The concierge may return a compound name like "Barcelona + the Pyrenees
  // (Catalonia), Spain". Reduce it to the first proper place ("Barcelona") so it
  // matches a Wikipedia article and yields an iconic photo.
  const title = name
    .split(/[,(]/)[0]
    .split(/\s+\+\s+|\s+&\s+|\s+\/\s+|\s+and\s+/i)[0]
    .trim();
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*" +
    "&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=800&titles=" +
    encodeURIComponent(title);
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const pages = data?.query?.pages || {};
    for (const key of Object.keys(pages)) {
      const source = pages[key]?.thumbnail?.source;
      // Skip maps/flags/locator/satellite images some articles use as their lead
      // image — a themed fallback photo looks far better than a map of the region.
      if (source && !isMapLike(source)) return source;
    }
    return null;
  } catch {
    return null;
  }
}

// True for Wikipedia lead images that are maps, flags, locator dots or satellite
// shots rather than scenic travel photos.
function isMapLike(url) {
  const lower = url.toLowerCase();
  return (
    lower.endsWith(".svg") ||
    lower.includes(".svg.") ||
    lower.includes("location") ||
    lower.includes("locator") ||
    lower.includes("_map") ||
    lower.includes("flag_") ||
    lower.includes("orthographic") ||
    lower.includes("satellite") ||
    lower.includes("_esa")
  );
}
