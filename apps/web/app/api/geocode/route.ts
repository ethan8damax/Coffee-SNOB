import { NextResponse } from "next/server";
import { toPlace, type NominatimResult, type Place } from "@/lib/geocode";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// Place names don't move; cache generously to stay well inside Nominatim's
// usage policy (max ~1 request/second, results should be cached, not
// re-fetched per keystroke).
const CACHE_TTL_MS = 60 * 60 * 1000;

type CacheEntry = { expiresAt: number; body: { places: Place[] } };
const cache = new Map<string, CacheEntry>();

// ponytail: wide-open CORS — same reasoning as nearby-shops/route.ts (public,
// unauthenticated, read-only proxy; the app's web export runs on a different
// origin).
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ places: [] }, { headers: CORS_HEADERS });

  const key = q.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.body, { headers: CORS_HEADERS });
  }

  const params = new URLSearchParams({ q, format: "json", limit: "6" });
  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: {
      // Nominatim's usage policy requires a real User-Agent identifying the app
      // (its server 403s the default Node one, same as Overpass's 406).
      "User-Agent": "coffeesnob.app geocode proxy (https://coffeesnob.app)",
    },
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Geocoding request failed" }, { status: 502, headers: CORS_HEADERS });
  }

  const raw = (await response.json()) as NominatimResult[];
  const places = raw.map(toPlace).filter((p): p is Place => p !== null);
  const body = { places };

  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, body });
  return NextResponse.json(body, { headers: CORS_HEADERS });
}
