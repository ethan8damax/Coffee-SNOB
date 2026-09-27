import { NextResponse } from "next/server";
import { citiesWithGuides } from "@coffeesnob/supabase";
import { getBlocklist } from "@/lib/chain-blocklist";
import { getSupabase } from "@/lib/supabase";
import { matchesQuery, placeTails, toSearchHit, type Place, type PhotonFeature, type SearchHit } from "@/lib/photon";

// The map's search box: cafés + places worldwide via Photon. Fair-use public
// API (photon.komoot.io); if volume grows, self-host it — one Docker image.
const PHOTON_URL = "https://photon.komoot.io/api/";
const PHOTON_TIMEOUT_MS = 8000;
// Same public, read-only posture as nearby-shops (see its CORS note).
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };
// Search results barely change; the location bias is rounded (below) so
// nearby searchers share CDN entries. Errors are never cached.
const CACHE_HEADERS = { ...CORS_HEADERS, "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" };
const CITY_VALUES = new Set(["city", "town", "village"]);

async function photon(q: string, tags: string[], limit: number, bias: { lat: string; lon: string } | null): Promise<PhotonFeature[]> {
  const params = new URLSearchParams({ q, limit: String(limit), lang: "en" });
  for (const tag of tags) params.append("osm_tag", tag);
  if (bias) {
    params.set("lat", bias.lat);
    params.set("lon", bias.lon);
  }
  const res = await fetch(`${PHOTON_URL}?${params}`, {
    headers: { "User-Agent": "coffeesnob.app search proxy (https://coffeesnob.app)" },
    signal: AbortSignal.timeout(PHOTON_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(String(res.status));
  return ((await res.json()) as { features: PhotonFeature[] }).features;
}

// "muchacho atlanta": is the tail of the query a city? Then the app searches
// the coffee index there for the rest ("muchacho") — that catches coffee-
// serving restaurants Photon's café filter can't. Never fails the search.
// ponytail: up to 2 extra Photon calls per multi-word query, CDN-cached like the rest.
async function findScope(q: string, bias: { lat: string; lon: string } | null) {
  for (const { name, place } of placeTails(q)) {
    const features = await photon(place, ["place"], 5, bias).catch(() => []);
    const f = features.find((f) => CITY_VALUES.has(f.properties.osm_value) && matchesQuery(place, [f.properties.name, f.properties.state]));
    if (!f) continue;
    const hit = toSearchHit(f, []);
    if (hit?.kind === "place") return { name, place: { primary: hit.place.primary, secondary: hit.place.secondary, lat: hit.place.lat, lng: hit.place.lng } };
  }
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ places: [], shops: [], scoped: null }, { headers: CORS_HEADERS });

  // Bias toward where the searcher is looking; ~10 km rounding is plenty for a bias.
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const bias =
    url.searchParams.has("lat") && url.searchParams.has("lng") && Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat: lat.toFixed(1), lon: lng.toFixed(1) }
      : null;

  let features: PhotonFeature[];
  let scoped: Awaited<ReturnType<typeof findScope>>;
  try {
    [features, scoped] = await Promise.all([photon(q, ["amenity:cafe", "place"], 12, bias), findScope(q, bias)]);
  } catch {
    return NextResponse.json({ error: "Search request failed" }, { status: 502, headers: CORS_HEADERS });
  }

  const chains = await getBlocklist();
  const hits = features
    .filter((f) => matchesQuery(q, [f.properties.name, f.properties.city, f.properties.state]))
    .map((f) => toSearchHit(f, chains))
    .filter((h): h is SearchHit => h !== null);
  const found = hits.flatMap((h) => (h.kind === "place" ? [h.place] : []));
  const shops = hits.flatMap((h) => (h.kind === "shop" ? [{ externalId: h.externalId, name: h.name, secondary: h.secondary, lat: h.lat, lng: h.lng }] : []));
  // "Guide" only means a curated editorial guide. If that check fails, drop
  // every link and don't cache.
  let guides = new Map<string, string>();
  let guideCheckOk = true;
  try {
    guides = await citiesWithGuides(getSupabase(), found.flatMap((p) => (p.cityKey ? [p.cityKey] : [])));
  } catch {
    guideCheckOk = false;
  }
  const places = found.map(({ cityKey, ...p }): Omit<Place, "cityKey"> => ({ ...p, guideSlug: (cityKey && guides.get(cityKey)) || null }));
  // If the chain list couldn't load (cold start + Supabase down), results are
  // unfiltered — serve them, but don't let the CDN keep them.
  const cacheable = chains.length > 0 && guideCheckOk;
  return NextResponse.json({ places, shops, scoped }, { headers: cacheable ? CACHE_HEADERS : CORS_HEADERS });
}
