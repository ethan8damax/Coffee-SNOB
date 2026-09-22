import { NextResponse } from "next/server";
import { buildOverpassQuery, tileKey, toNearbyShop, type OverpassElement } from "@/lib/nearby-shops";

// The main public instance has flaked repeatedly (outages, "server too busy"
// 504s) — kumi.systems is Overpass's other well-known public mirror, same
// query language and data. Tried in order; the first to answer wins.
const OVERPASS_URLS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const OVERPASS_TIMEOUT_MS = 15 * 1000;
// ponytail: in-memory, per-instance cache only — good enough at launch
// scale; move to a shared cache (Vercel KV/Upstash) if the public Overpass
// instance's fair-use limits become a real constraint (see spec's
// "Out of scope" section).
const CACHE_TTL_MS = 10 * 60 * 1000;

type CacheEntry = { expiresAt: number; body: { shops: ReturnType<typeof toNearbyShop>[] } };
const cache = new Map<string, CacheEntry>();

// ponytail: wide-open CORS — this is a public, unauthenticated, read-only
// proxy over public OSM data, and its only client (apps/app's web export)
// legitimately runs on a different origin than this route (a separate
// Vercel project), plus localhost during dev. No per-origin allowlist
// needed for data this open.
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const minLat = Number(url.searchParams.get("minLat"));
  const minLng = Number(url.searchParams.get("minLng"));
  const maxLat = Number(url.searchParams.get("maxLat"));
  const maxLng = Number(url.searchParams.get("maxLng"));

  if ([minLat, minLng, maxLat, maxLng].some((n) => Number.isNaN(n))) {
    return NextResponse.json({ error: "minLat, minLng, maxLat, maxLng are required" }, { status: 400, headers: CORS_HEADERS });
  }

  const bounds = { minLat, minLng, maxLat, maxLng };
  // "search a shop by name" (map-search.tsx) hits this same endpoint with a
  // wide box + ?q=, so the name has to be part of the cache key too.
  const name = url.searchParams.get("q") || undefined;
  const key = `${tileKey(minLat, minLng, maxLat, maxLng)}|${name ?? ""}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.body, { headers: CORS_HEADERS });
  }

  const query = buildOverpassQuery(bounds, name);
  let response: Response | null = null;
  for (const endpoint of OVERPASS_URLS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // Overpass's server 406s Node's default "node" User-Agent; it also
          // asks API consumers to identify their app per its usage policy.
          "User-Agent": "coffeesnob.app nearby-shops proxy (https://coffeesnob.app)",
        },
        signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
      });
      if (res.ok) {
        response = res;
        break;
      }
    } catch {
      // timed out or unreachable — fall through to the next mirror
    }
  }

  if (!response) {
    return NextResponse.json({ error: "Overpass request failed" }, { status: 502, headers: CORS_HEADERS });
  }

  const raw = (await response.json()) as { elements: OverpassElement[] };
  const shops = raw.elements.map(toNearbyShop).filter((s) => s !== null);
  const body = { shops };

  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, body });
  return NextResponse.json(body, { headers: CORS_HEADERS });
}
