import { NextResponse } from "next/server";
import { toLocality, type PhotonFeature } from "@/lib/photon";

// Which city a shop is in, for its city page — called once when a shop is
// first logged. Photon reverse geocoding (same fair-use service as /api/search).
const PHOTON_REVERSE_URL = "https://photon.komoot.io/reverse";
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };
// A place's city doesn't move; the app rounds to ~100 m so repeats share entries.
const CACHE_HEADERS = { ...CORS_HEADERS, "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!url.searchParams.get("lat") || !url.searchParams.get("lng") || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400, headers: CORS_HEADERS });
  }
  try {
    const params = new URLSearchParams({ lat: lat.toFixed(3), lon: lng.toFixed(3), lang: "en" });
    const res = await fetch(`${PHOTON_REVERSE_URL}?${params}`, {
      headers: { "User-Agent": "coffeesnob.app locate proxy (https://coffeesnob.app)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const { features } = (await res.json()) as { features: PhotonFeature[] };
    // Don't cache an empty answer (e.g. open ocean) for a day — it may just be transient.
    return NextResponse.json(toLocality(features[0]), { headers: features[0] ? CACHE_HEADERS : CORS_HEADERS });
  } catch {
    return NextResponse.json({ error: "Locate request failed" }, { status: 502, headers: CORS_HEADERS });
  }
}
