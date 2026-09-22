import { NextResponse } from "next/server";
import { formatShopLocation, type NominatimAddress } from "@/lib/geocode";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
// A shop's city doesn't move; cache generously (same reasoning as the forward
// geocode route — stay well inside Nominatim's ~1 req/s usage policy).
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry = { expiresAt: number; body: { secondary: string } };
const cache = new Map<string, CacheEntry>();

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

// Rounded to ~1km so shops clustered in the same area share a cache entry.
function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400, headers: CORS_HEADERS });
  }

  const key = cacheKey(lat, lng);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.body, { headers: CORS_HEADERS });
  }

  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: "json", addressdetails: "1" });
  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { "User-Agent": "coffeesnob.app geocode proxy (https://coffeesnob.app)" },
  });
  if (!response.ok) {
    return NextResponse.json({ error: "Reverse geocoding request failed" }, { status: 502, headers: CORS_HEADERS });
  }

  const raw = (await response.json()) as { address?: NominatimAddress };
  const body = { secondary: formatShopLocation(raw.address) };

  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, body });
  return NextResponse.json(body, { headers: CORS_HEADERS });
}
