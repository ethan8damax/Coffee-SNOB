import { NextResponse } from "next/server";
import { citiesWithVerdicts } from "@coffeesnob/supabase";
import { getBlocklist } from "@/lib/chain-blocklist";
import { getSupabase } from "@/lib/supabase";
import { toSearchHit, type PhotonFeature, type SearchHit } from "@/lib/photon";

// The map's search box: cafés + places worldwide via Photon. Fair-use public
// API (photon.komoot.io); if volume grows, self-host it — one Docker image.
const PHOTON_URL = "https://photon.komoot.io/api/";
const PHOTON_TIMEOUT_MS = 8000;
// Same public, read-only posture as nearby-shops (see its CORS note).
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };
// Search results barely change; the location bias is rounded (below) so
// nearby searchers share CDN entries. Errors are never cached.
const CACHE_HEADERS = { ...CORS_HEADERS, "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ places: [], shops: [] }, { headers: CORS_HEADERS });

  const params = new URLSearchParams({ q, limit: "12", lang: "en" });
  params.append("osm_tag", "amenity:cafe");
  params.append("osm_tag", "place");
  // Bias toward where the searcher is looking; ~10 km rounding is plenty for a bias.
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (url.searchParams.has("lat") && url.searchParams.has("lng") && Number.isFinite(lat) && Number.isFinite(lng)) {
    params.set("lat", lat.toFixed(1));
    params.set("lon", lng.toFixed(1));
  }

  let features: PhotonFeature[];
  try {
    const res = await fetch(`${PHOTON_URL}?${params}`, {
      headers: { "User-Agent": "coffeesnob.app search proxy (https://coffeesnob.app)" },
      signal: AbortSignal.timeout(PHOTON_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(String(res.status));
    features = ((await res.json()) as { features: PhotonFeature[] }).features;
  } catch {
    return NextResponse.json({ error: "Search request failed" }, { status: 502, headers: CORS_HEADERS });
  }

  const chains = await getBlocklist();
  const hits = features.map((f) => toSearchHit(f, chains)).filter((h): h is SearchHit => h !== null);
  const places = hits.flatMap((h) => (h.kind === "place" ? [h.place] : []));
  const shops = hits.flatMap((h) => (h.kind === "shop" ? [{ externalId: h.externalId, name: h.name, secondary: h.secondary, lat: h.lat, lng: h.lng }] : []));
  // A city only has a page once it has rated shops, so only those keep a
  // "Best in <city>" link. If that check fails, drop every link and don't cache.
  let cityCheckOk = true;
  try {
    const withVerdicts = await citiesWithVerdicts(getSupabase(), places.flatMap((p) => (p.cityKey ? [p.cityKey] : [])));
    for (const p of places) if (p.cityKey && !withVerdicts.has(p.cityKey)) p.cityKey = null;
  } catch {
    cityCheckOk = false;
    for (const p of places) p.cityKey = null;
  }
  // If the chain list couldn't load (cold start + Supabase down), results are
  // unfiltered — serve them, but don't let the CDN keep them.
  const cacheable = chains.length > 0 && cityCheckOk;
  return NextResponse.json({ places, shops }, { headers: cacheable ? CACHE_HEADERS : CORS_HEADERS });
}
