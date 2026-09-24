import { NextResponse } from "next/server";
import { getChainBlocklist } from "@coffeesnob/supabase";
import { buildOverpassQuery, isChain, isCoffeePlace, toNearbyShop, type ChainEntry, type OverpassElement } from "@/lib/nearby-shops";
import { getSupabase } from "@/lib/supabase";

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

// The chain blocklist, cached briefly so admin edits land within a minute
// (plus up to CACHE_TTL_MS for boxes already cached). If Supabase is down the
// map still works: it serves the last list it had, or no filter at all.
const BLOCKLIST_TTL_MS = 60 * 1000;
let blocklist: { expiresAt: number; names: ChainEntry[] } = { expiresAt: 0, names: [] };
async function getBlocklist(): Promise<ChainEntry[]> {
  if (blocklist.expiresAt > Date.now()) return blocklist.names;
  try {
    blocklist = { expiresAt: Date.now() + BLOCKLIST_TTL_MS, names: await getChainBlocklist(getSupabase()) };
  } catch {
    blocklist = { ...blocklist, expiresAt: Date.now() + 5000 };
  }
  return blocklist.names;
}

// ponytail: wide-open CORS — this is a public, unauthenticated, read-only
// proxy over public OSM data, and its only client (apps/app's web export)
// legitimately runs on a different origin than this route (a separate
// Vercel project), plus localhost during dev. No per-origin allowlist
// needed for data this open.
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

// Grid-snapped boxes (see apps/app/lib/map/bounds.ts snapToGrid) repeat across
// viewers, so let Vercel's CDN serve them for 10 minutes and stale for a day
// while it refreshes. Errors are never cached.
const CACHE_HEADERS = { ...CORS_HEADERS, "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400" };

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
  // wide box + ?q=, so the name has to be part of the cache key too. Keyed on
  // the exact box: the app snaps boxes to a grid, so repeats already match, and
  // a looser key could hand one box another box's shops (which the CDN would
  // then share with everyone under this URL).
  const name = url.searchParams.get("q") || undefined;
  const key = `${minLat},${minLng},${maxLat},${maxLng}|${name ?? ""}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.body, { headers: CACHE_HEADERS });
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

  // Overpass can answer 200 with a `remark` (timeout / out of memory) and no
  // elements — a failure, so don't cache it anywhere.
  const raw = (await response.json()) as { elements: OverpassElement[]; remark?: string };
  const chains = await getBlocklist();
  const shops = raw.elements
    .filter((el) => isCoffeePlace(el.tags ?? {}) && !isChain(el.tags ?? {}, chains))
    .map(toNearbyShop)
    .filter((s) => s !== null);
  const body = { shops };

  if (raw.remark) return NextResponse.json(body, { headers: CORS_HEADERS });
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, body });
  return NextResponse.json(body, { headers: CACHE_HEADERS });
}
