# Map Phase 2 — Search Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Search finds cafés and cities anywhere in ~1s, shows our rated shops instantly, and opens far-away picks properly.

**Architecture:** A new `/api/search` route in `apps/web` proxies Photon (komoot's OSM geocoder) for cafés + places, CDN-cached, with chain/coffee filtering and a "City, ST, USA" line built by the existing `lib/geocode.ts` helpers. The app's search box shows three stages as they land (our rated shops → Photon → local Overpass name search only if Photon found <3 shops), merged and ranked by a pure function. Far-away picks stay selected via a pinned result. The old Nominatim routes are deleted.

**Tech Stack:** Next.js 15 route handlers, Expo Router (react-native-web), Supabase JS, vitest. Spec: `docs/superpowers/specs/2026-09-23-map-browse-and-search-design.md` (Phase 2).

**Commands:** `cd apps/web && npx vitest run <file>` · `cd apps/app && npx vitest run <file>` · `cd packages/supabase && npx vitest run` · typecheck `npx tsc --noEmit -p .` in each.

---

## File map

| File | Change |
|---|---|
| `apps/web/lib/geocode.ts` (+test) | export `abbreviateCountry`; delete Nominatim-search-only code (`formatAddress`, `toPlace`, `NominatimResult`, `Place`) |
| `apps/web/lib/photon.ts` (+test) | Create: Photon feature → search hit |
| `apps/web/lib/chain-blocklist.ts` | Create: `getBlocklist()` moved out of the nearby-shops route |
| `apps/web/app/api/search/route.ts` | Create: Photon proxy |
| `apps/web/app/api/nearby-shops/route.ts` | import `getBlocklist` from lib |
| `apps/web/app/api/geocode/`, `apps/web/app/api/reverse-geocode/` | Delete |
| `packages/supabase/src/queries.ts` (+test) | `searchRatedShops` matches every word |
| `apps/app/lib/map/geocode.ts` (+test) | `geocodePlaces` → `searchEverywhere` |
| `apps/app/lib/map/search-sort.ts` (+test) | `sortByDistance` → `mergeResults` + `rankResults` |
| `apps/app/lib/map/shop-list.ts` (+test) | `withPinned` |
| `apps/app/components/map/map-search.tsx` | staged results + "Searching more cafés…" |
| `apps/app/app/(tabs)/map.tsx` | pinned far-away pick; selected row not limited by the 50-row cap |

---

### Task 1: Photon → search hit (pure)

**Files:**
- Modify: `apps/web/lib/geocode.ts`, `apps/web/lib/geocode.test.ts`
- Create: `apps/web/lib/photon.ts`, `apps/web/lib/photon.test.ts`

- [ ] **Step 1: Write the failing test** `apps/web/lib/photon.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toSearchHit, type PhotonFeature } from "./photon";

const feature = (properties: PhotonFeature["properties"], lon = -84.36, lat = 33.75): PhotonFeature => ({
  geometry: { coordinates: [lon, lat] },
  properties,
});
const chains = [{ name: "starbucks", wikidata: "Q37158" }];

describe("toSearchHit", () => {
  it("maps a café to a shop hit with our external id and a City, ST, USA line", () => {
    const hit = toSearchHit(
      feature({ osm_type: "N", osm_id: 12348556801, osm_key: "amenity", osm_value: "cafe", name: "Dancing Goats Coffee", city: "Atlanta", state: "Georgia", countrycode: "US" }),
      chains,
    );
    expect(hit).toEqual({ kind: "shop", externalId: "node/12348556801", name: "Dancing Goats Coffee", secondary: "Atlanta, GA, USA", lat: 33.75, lng: -84.36 });
  });

  it("maps ways and relations to way/ and relation/ ids", () => {
    const hit = toSearchHit(feature({ osm_type: "W", osm_id: 51305933, osm_key: "amenity", osm_value: "cafe", name: "Dancing Goats Coffee Bar", city: "Decatur", state: "Georgia", countrycode: "US" }), chains);
    expect(hit && hit.kind === "shop" && hit.externalId).toBe("way/51305933");
  });

  it("maps a city to a place hit headlined by its name", () => {
    const hit = toSearchHit(feature({ osm_type: "R", osm_id: 119557, osm_key: "place", osm_value: "city", name: "Atlanta", state: "Georgia", countrycode: "US" }), chains);
    expect(hit).toEqual({ kind: "place", place: { id: "R119557", primary: "Atlanta", secondary: "GA, USA", lat: 33.75, lng: -84.36 } });
  });

  it("gives states just the country and countries nothing", () => {
    const state = toSearchHit(feature({ osm_type: "R", osm_id: 1, osm_key: "place", osm_value: "state", name: "Georgia", state: "Georgia", countrycode: "US" }), chains);
    const country = toSearchHit(feature({ osm_type: "R", osm_id: 2, osm_key: "place", osm_value: "country", name: "Portugal", countrycode: "PT" }), chains);
    expect(state && state.kind === "place" && state.place.secondary).toBe("USA");
    expect(country && country.kind === "place" && country.place.secondary).toBe("");
  });

  it("drops chains, non-coffee cafés, stray place types, and anything unnamed", () => {
    expect(toSearchHit(feature({ osm_type: "N", osm_id: 1, osm_key: "amenity", osm_value: "cafe", name: "Starbucks" }), chains)).toBeNull();
    expect(toSearchHit(feature({ osm_type: "N", osm_id: 2, osm_key: "amenity", osm_value: "cafe", name: "Kung Fu Tea" }), chains)).toBeNull();
    expect(toSearchHit(feature({ osm_type: "N", osm_id: 3, osm_key: "place", osm_value: "locality", name: "Blue Bottle Terrace" }), chains)).toBeNull();
    expect(toSearchHit(feature({ osm_type: "N", osm_id: 4, osm_key: "amenity", osm_value: "restaurant", name: "Muchacho" }), chains)).toBeNull();
    expect(toSearchHit(feature({ osm_type: "N", osm_id: 5, osm_key: "amenity", osm_value: "cafe" }), chains)).toBeNull();
  });
});
```

- [ ] **Step 2: Run** — `cd apps/web && npx vitest run lib/photon.test.ts` → FAIL (module missing).

- [ ] **Step 3: Export `abbreviateCountry`** in `apps/web/lib/geocode.ts` (change `function abbreviateCountry` to `export function abbreviateCountry`).

- [ ] **Step 4: Implement** `apps/web/lib/photon.ts`:

```ts
import { abbreviateCountry, abbreviateState, formatShopLocation } from "./geocode";
import { isChain, isCoffeePlace, type ChainEntry } from "./nearby-shops";

// Photon (komoot's OpenStreetMap geocoder, photon.komoot.io) powers the map's
// search box: cafés and places worldwide in one fast, typo-tolerant call, with
// city/state on every result. Pure mapping here; fetch + cache in
// app/api/search/route.ts.
export type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type: "N" | "W" | "R";
    osm_id: number;
    osm_key: string;
    osm_value: string;
    name?: string;
    city?: string;
    state?: string;
    countrycode?: string;
  };
};

export type Place = { id: string; primary: string; secondary: string; lat: number; lng: number };
export type SearchHit =
  | { kind: "place"; place: Place }
  | { kind: "shop"; externalId: string; name: string; secondary: string; lat: number; lng: number };

const OSM_TYPE = { N: "node", W: "way", R: "relation" } as const;
// Real places people search for — not OSM's "locality"/"isolated_dwelling"
// noise ("Blue Bottle Terrace", a Colombian hamlet named "Muchacho").
const PLACE_VALUES = new Set(["city", "town", "village", "hamlet", "suburb", "borough", "quarter", "neighbourhood", "state", "country"]);

export function toSearchHit(f: PhotonFeature, chains: ChainEntry[]): SearchHit | null {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  if (!p.name) return null;
  if (p.osm_key === "place" && PLACE_VALUES.has(p.osm_value)) {
    const country = p.countrycode ? abbreviateCountry(p.countrycode) : "";
    const secondary =
      p.osm_value === "country" ? "" :
      p.osm_value === "state" ? country :
      [p.state ? abbreviateState(p.state, p.countrycode) : null, country].filter(Boolean).join(", ");
    return { kind: "place", place: { id: `${p.osm_type}${p.osm_id}`, primary: p.name, secondary, lat, lng } };
  }
  // Cafés only: Photon can't filter restaurants/bars by cuisine, so coffee-
  // serving restaurants come from the local Overpass search instead.
  if (p.osm_key !== "amenity" || p.osm_value !== "cafe") return null;
  const tags = { name: p.name };
  if (!isCoffeePlace(tags) || isChain(tags, chains)) return null;
  return {
    kind: "shop",
    externalId: `${OSM_TYPE[p.osm_type]}/${p.osm_id}`,
    name: p.name,
    secondary: formatShopLocation({ city: p.city, state: p.state, country_code: p.countrycode }),
    lat,
    lng,
  };
}
```

- [ ] **Step 5: Run** → photon tests PASS; full `npx vitest run` in apps/web PASS; `npx tsc --noEmit -p .` clean.

- [ ] **Step 6: Commit** — `git add -A apps/web && git commit -m "Photon feature to search hit"`

---

### Task 2: `/api/search` route + shared blocklist loader

**Files:**
- Create: `apps/web/lib/chain-blocklist.ts`, `apps/web/app/api/search/route.ts`
- Modify: `apps/web/app/api/nearby-shops/route.ts`

- [ ] **Step 1: Move the blocklist loader.** Create `apps/web/lib/chain-blocklist.ts` by moving (cut, not copy) the `BLOCKLIST_TTL_MS` constant, the module-level `blocklist` variable, `getBlocklist()` and their comment out of `apps/web/app/api/nearby-shops/route.ts`, exporting `getBlocklist`. It needs `import { getChainBlocklist } from "@coffeesnob/supabase";`, `import type { ChainEntry } from "./nearby-shops";` and `import { getSupabase } from "./supabase";`. In the route, remove the now-unused imports and add `import { getBlocklist } from "@/lib/chain-blocklist";`.

- [ ] **Step 2: Create** `apps/web/app/api/search/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getBlocklist } from "@/lib/chain-blocklist";
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
  return NextResponse.json({ places, shops }, { headers: CACHE_HEADERS });
}
```
The app sends `lat`/`lng`; the route rounds them before calling Photon. For CDN sharing the **app** must also round them (Task 5).

- [ ] **Step 3: Typecheck + lint + tests** — in apps/web: `npx tsc --noEmit -p . && npx eslint lib app/api && npx vitest run` → clean / pass.

- [ ] **Step 4: Live check** (web dev server: `cd apps/web && npx next dev -p 3107` if not already running):
```bash
for q in "dancing%20goats" "atlanta" "blue%20bottle" "starbucks"; do curl -s --max-time 20 "http://localhost:3107/api/search?q=$q&lat=36.2&lng=-86.8" | python3 -c "import json,sys;d=json.load(sys.stdin);print('$q', [p['primary']+' / '+p['secondary'] for p in d['places']][:3], [s['name']+' / '+s['secondary'] for s in d['shops']][:4])"; done
curl -sI "http://localhost:3107/api/search?q=atlanta&lat=36.2&lng=-86.8" | grep -i cache-control
```
Expected: "dancing goats" → Atlanta/Decatur shops with "Atlanta, GA, USA"-style lines; "atlanta" → first place "Atlanta / GA, USA"; "blue bottle" → Blue Bottle Coffee shops; "starbucks" → no shops; header `public, s-maxage=3600, stale-while-revalidate=86400`.

- [ ] **Step 5: Commit** — `git add -A apps/web && git commit -m "Add /api/search (Photon); share the chain blocklist loader"`

---

### Task 3: Rated-shop search matches every word

**Files:**
- Modify: `packages/supabase/src/queries.ts` (`searchRatedShops`)
- Test: `packages/supabase/test/queries.test.ts`

- [ ] **Step 1: Write the failing test** (append; add `searchRatedShops` to the import from `../src/queries`):

```ts
describe("searchRatedShops", () => {
  function recordingClient() {
    const ilikes: [string, string][] = [];
    const builder: any = {
      ilike: (col: string, pattern: string) => { ilikes.push([col, pattern]); return builder; },
      not: () => builder,
      order: () => builder,
      limit: () => Promise.resolve({ data: [{ id: "s1", name: "Dancing Goats Coffee" }], error: null }),
    };
    return { ilikes, client: { from: () => ({ select: () => builder }) } as any };
  }

  it("matches every word, in any order", async () => {
    const { ilikes, client } = recordingClient();
    const rows = await searchRatedShops(client, "  goats   dancing ");
    expect(ilikes).toEqual([["name", "%goats%"], ["name", "%dancing%"]]);
    expect(rows).toEqual([{ id: "s1", name: "Dancing Goats Coffee" }]);
  });

  it("strips wildcard characters and skips too-short queries", async () => {
    const { ilikes, client } = recordingClient();
    await searchRatedShops(client, "50%_off\\");
    expect(ilikes).toEqual([["name", "%50off%"]]);
    expect(await searchRatedShops(recordingClient().client, "a")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** — `cd packages/supabase && npx vitest run` → FAIL (one ilike with the whole phrase).

- [ ] **Step 3: Implement** — replace the body of `searchRatedShops` with:

```ts
export async function searchRatedShops(client: Client, query: string, limit = 8) {
  const q = query.trim().replace(/[%_\\]/g, "");
  if (q.length < 2) return [];
  // Every word must appear in the name, in any order ("goats dancing" finds
  // "Dancing Goats Coffee").
  let request = client
    .from("shop_ratings")
    .select("id, name, lat, lng, neighborhood, is_snob_approved, tag, price_tier, rating, log_count, external_id");
  for (const word of q.split(/\s+/)) request = request.ilike("name", `%${word}%`);
  const { data, error } = await request.not("rating", "is", null).order("rating", { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}
```
Keep the existing comment above the function but update it to mention word matching.

- [ ] **Step 4: Run** → PASS; `npx tsc --noEmit -p .` in packages/supabase and apps/app clean.

- [ ] **Step 5: Commit** — `git commit -am "Rated-shop search matches every word"`

---

### Task 4: Merge + rank search results (pure)

**Files:**
- Modify: `apps/app/lib/map/search-sort.ts`, `apps/app/lib/map/search-sort.test.ts`

- [ ] **Step 1: Replace the tests** in `search-sort.test.ts` with (keep any existing fixture helpers you need; `RatedShopPin` now has `externalId`):

```ts
import { describe, it, expect } from "vitest";
import { mergeResults, rankResults, type SearchResult } from "./search-sort";

const place = (id: string, primary: string, lat: number, lng: number): SearchResult => ({ kind: "place", place: { id, primary, secondary: "", lat, lng } });
const nearby = (externalId: string, name: string, lat: number, lng: number): SearchResult => ({
  kind: "nearby", secondary: null,
  shop: { externalId, name, lat, lng, address: null, hours: null, website: null, phone: null },
});
const rated = (id: string, name: string, lat: number, lng: number, externalId: string | null = null): SearchResult => ({
  kind: "shop", secondary: null,
  shop: { id, name, lat, lng, neighborhood: null, isSnobApproved: false, tag: null, priceTier: null, rating: 4, logCount: 1, externalId },
});
const key = (r: SearchResult) => (r.kind === "place" ? r.place.id : r.kind === "shop" ? r.shop.id : r.shop.externalId);
const nashville = { lat: 36.16, lng: -86.78 };

describe("mergeResults", () => {
  it("dedupes by OSM id, keeping the rated version", () => {
    const merged = mergeResults([nearby("way/1", "Muchacho", 33.7, -84.3)], [rated("s1", "Muchacho", 33.7, -84.3, "way/1"), nearby("node/2", "Other", 0, 0)]);
    expect(merged.map(key)).toEqual(["s1", "node/2"]);
    expect(mergeResults(merged, [nearby("way/1", "Muchacho", 33.7, -84.3)]).map(key)).toEqual(["s1", "node/2"]);
  });

  it("dedupes places by id", () => {
    expect(mergeResults([place("R1", "Atlanta", 33.7, -84.4)], [place("R1", "Atlanta", 33.7, -84.4)]).map(key)).toEqual(["R1"]);
  });
});

describe("rankResults", () => {
  it("puts exact and prefix name matches first, then rated, then nearest", () => {
    const results = [
      nearby("node/9", "The Dancing Goats Coffee Bar", 33.77, -84.36),
      place("R2", "Atlanta", 33.75, -84.39),
      nearby("node/1", "Dancing Goats Coffee", 33.75, -84.36),
      rated("s1", "Dancing Goats Coffee", 33.78, -84.29),
      nearby("node/3", "Nashville Dancing Goats", 36.16, -86.78),
    ];
    // Tiers: s1 + node/1 start with the query (tier 1, rated first); node/3 and
    // node/9 contain it at a later word (tier 2, nearest to Nashville first); R2 doesn't match.
    expect(rankResults(results, "dancing goats", nashville).map(key)).toEqual(["s1", "node/1", "node/3", "node/9", "R2"]);
  });

  it("puts the exact city first when searching a place", () => {
    const results = [place("R3", "Atlanta", 33.07, -94.16), nearby("node/5", "Atlanta Coffee Roasters", 33.75, -84.39), place("R1", "Atlanta", 33.75, -84.39)];
    expect(rankResults(results, "atlanta", nashville).map(key)).toEqual(["R1", "R3", "node/5"]);
  });

  it("ignores accents, case and punctuation when matching", () => {
    const results = [nearby("node/2", "Other Cafe", 0, 0), nearby("node/1", "Café Kitsuné", 0, 0)];
    expect(rankResults(results, "cafe kitsune", null).map(key)).toEqual(["node/1", "node/2"]);
  });
});
```

- [ ] **Step 2: Run** — `cd apps/app && npx vitest run lib/map/search-sort.test.ts` → FAIL.

- [ ] **Step 3: Implement** — in `search-sort.ts`, keep `SearchResult` and `resultPoint`, delete `sortByDistance`, and add:

```ts
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function resultName(r: SearchResult): string {
  return r.kind === "place" ? r.place.primary : r.shop.name;
}

// OSM id when there is one, so the same café from different sources collapses.
function resultKey(r: SearchResult): string {
  if (r.kind === "place") return `p:${r.place.id}`;
  if (r.kind === "shop") return r.shop.externalId ?? `s:${r.shop.id}`;
  return r.shop.externalId;
}

// Search results arrive in stages; later stages can repeat a shop an earlier
// one found. Keep one per key, preferring the rated version (it has a verdict).
export function mergeResults(existing: SearchResult[], incoming: SearchResult[]): SearchResult[] {
  const byKey = new Map(existing.map((r) => [resultKey(r), r]));
  for (const r of incoming) {
    const k = resultKey(r);
    const prev = byKey.get(k);
    if (!prev || (prev.kind !== "shop" && r.kind === "shop")) byKey.set(k, r);
  }
  return [...byKey.values()];
}

// 0 exact name, 1 name starts with the query, 2 query starts a later word,
// 3 anything else (fuzzy matches from Photon).
function matchTier(name: string, q: string): number {
  const n = normalize(name);
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (` ${n}`.includes(` ${q}`)) return 2;
  return 3;
}

// Best name match first; within a tier rated shops before everything else,
// then nearest to what's on screen.
export function rankResults(results: SearchResult[], query: string, origin: { lat: number; lng: number } | null): SearchResult[] {
  const q = normalize(query);
  const score = (r: SearchResult) => ({
    tier: matchTier(resultName(r), q),
    rated: r.kind === "shop" ? 0 : 1,
    dist: origin ? distanceKm(origin, resultPoint(r)) : 0,
  });
  return results
    .map((r) => ({ r, s: score(r) }))
    .sort((a, b) => a.s.tier - b.s.tier || a.s.rated - b.s.rated || a.s.dist - b.s.dist)
    .map(({ r }) => r);
}
```
Update the header comment on `SearchResult` if it mentions sortByDistance.

- [ ] **Step 4: Run** → PASS (after `sortByDistance`'s caller is updated in Task 6, typecheck will pass; for now `npx tsc` will flag `map-search.tsx` still importing `sortByDistance` — change that import to `rankResults` and the call to `rankResults(combined, q, origin)` so the tree typechecks).

- [ ] **Step 5: Commit** — `git commit -am "Search results: merge across sources, rank by match then rated then distance"`

---

### Task 5: App client for `/api/search`

**Files:**
- Modify: `apps/app/lib/map/geocode.ts`, `apps/app/lib/map/geocode.test.ts`

- [ ] **Step 1: Replace the `geocodePlaces` tests** in `geocode.test.ts` with:

```ts
describe("searchEverywhere", () => {
  it("calls /api/search with the query and a rounded bias, and shapes shops as pins", async () => {
    const fetchSpy = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        places: [{ id: "R1", primary: "Atlanta", secondary: "GA, USA", lat: 33.7, lng: -84.4 }],
        shops: [{ externalId: "node/1", name: "Dancing Goats Coffee", secondary: "Atlanta, GA, USA", lat: 33.75, lng: -84.36 }],
      }),
    }));
    vi.stubGlobal("fetch", fetchSpy);
    const result = await searchEverywhere("dancing goats", { lat: 36.1627, lng: -86.7816 }, "https://example.com");
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/api/search?q=dancing+goats&lat=36.2&lng=-86.8");
    expect(result.places).toEqual([{ id: "R1", primary: "Atlanta", secondary: "GA, USA", lat: 33.7, lng: -84.4 }]);
    expect(result.shops).toEqual([{
      shop: { externalId: "node/1", name: "Dancing Goats Coffee", lat: 33.75, lng: -84.36, address: null, hours: null, website: null, phone: null },
      secondary: "Atlanta, GA, USA",
    }]);
    vi.unstubAllGlobals();
  });

  it("omits the bias without an origin, and throws on a failed response", async () => {
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ places: [], shops: [] }) }));
    vi.stubGlobal("fetch", fetchSpy);
    await searchEverywhere("atlanta", null, "https://example.com");
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/api/search?q=atlanta");
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 502 })));
    await expect(searchEverywhere("x y", null, "https://example.com")).rejects.toThrow("search request failed: 502");
    vi.unstubAllGlobals();
  });
});
```
and change the test file's import to `import { searchEverywhere, searchNearbyShops } from "./geocode";`.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — in `apps/app/lib/map/geocode.ts`, delete `geocodePlaces` and add:

```ts
// Cafés and places worldwide in one call (the web app's /api/search, Photon).
// The bias is rounded to ~10 km so nearby searchers share CDN-cached answers.
export async function searchEverywhere(
  query: string,
  origin: { lat: number; lng: number } | null,
  webAppUrl: string,
): Promise<{ places: Place[]; shops: { shop: NearbyShopPin; secondary: string }[] }> {
  const params = new URLSearchParams({ q: query });
  if (origin) {
    params.set("lat", origin.lat.toFixed(1));
    params.set("lng", origin.lng.toFixed(1));
  }
  const response = await fetch(`${webAppUrl}/api/search?${params}`);
  if (!response.ok) throw new Error(`search request failed: ${response.status}`);
  const body = (await response.json()) as {
    places: Place[];
    shops: { externalId: string; name: string; secondary: string; lat: number; lng: number }[];
  };
  return {
    places: body.places,
    shops: body.shops.map(({ externalId, name, secondary, lat, lng }) => ({
      shop: { externalId, name, lat, lng, address: null, hours: null, website: null, phone: null },
      secondary,
    })),
  };
}
```
Update the file's header comment (it describes the Nominatim proxies) to describe `/api/search` and `/api/nearby-shops`. `map-search.tsx` still calls `geocodePlaces` until Task 6 — to keep the tree compiling, in this task change that one call to `searchEverywhere(q, origin, webAppUrl).then((r) => r.places).catch(() => [])` and its import.

- [ ] **Step 4: Run** → `npx vitest run` and `npx tsc --noEmit -p .` in apps/app → pass / clean.

- [ ] **Step 5: Commit** — `git commit -am "App client for /api/search"`

---

### Task 6: Staged search box

**Files:**
- Modify: `apps/app/components/map/map-search.tsx`

- [ ] **Step 1: Add pending state** next to `results`: `const [pending, setPending] = useState(false);`. In `open()` and `close()` also call `setPending(false)`.

- [ ] **Step 2: Replace the search effect** (the whole `useEffect(() => { if (!active) return; … }, [active, query, webAppUrl, origin]);`) with:

```ts
  useEffect(() => {
    if (!active) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setPending(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      const { supabase } = require("../../lib/supabase");
      // Sources land in stages and the list updates as each arrives, so our
      // own rated shops show instantly instead of waiting on the slowest source.
      let merged: SearchResult[] = [];
      const add = (incoming: SearchResult[]) => {
        if (cancelled) return;
        merged = mergeResults(merged, incoming);
        setResults(rankResults(merged, q, origin));
      };
      setResults(null);
      setPending(true);
      // 1. Our rated shops (anywhere) — instant.
      const rated = searchRatedShops(supabase, q)
        .catch(() => [])
        .then((rows) => add(rows.map((row): SearchResult => ({ kind: "shop", shop: toRatedShopPin(row), secondary: row.neighborhood }))));
      // 2. Cafés and places worldwide (Photon) — ~1s.
      // 3. Only if that found few cafés: the local OSM name search, which also
      //    catches coffee-serving restaurants/bars Photon can't filter for.
      const wide = searchEverywhere(q, origin, webAppUrl)
        .catch(() => ({ places: [], shops: [] }))
        .then(async ({ places, shops }) => {
          add([
            ...places.map((place): SearchResult => ({ kind: "place", place })),
            ...shops.map(({ shop, secondary }): SearchResult => ({ kind: "nearby", shop, secondary })),
          ]);
          if (shops.length >= 3 || !origin) return;
          const local = await searchNearbyShops(q, origin, webAppUrl).catch(() => []);
          add(local.map((shop): SearchResult => ({ kind: "nearby", shop, secondary: shop.address })));
        });
      Promise.all([rated, wide]).then(() => {
        if (!cancelled) setPending(false);
      });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, query, webAppUrl, origin]);
```
Imports: `import { searchEverywhere, searchNearbyShops, type Place } from "../../lib/map/geocode";` and `import { mergeResults, rankResults, type SearchResult } from "../../lib/map/search-sort";` (drop `sortByDistance`/`geocodePlaces`). Update the comment above `searchNearbyShops` usage if it now reads wrong.

- [ ] **Step 3: Render the stages.** Change the dropdown condition from `{results && (` to `{(results || pending) && (`. Inside the `ScrollView`, replace the `results.length === 0 ? <Label …>No matches.</Label> : results.map(…)` expression with:
```tsx
          {(results ?? []).map((r) => { /* existing row rendering, unchanged */ })}
          {pending ? (
            <Label style={{ padding: 14, color: colors.ink3 }}>Searching more cafés…</Label>
          ) : results && results.length === 0 ? (
            <Label style={{ padding: 14, color: colors.ink3 }}>No matches.</Label>
          ) : null}
```
Keep the per-row rendering code exactly as it is, just moved into the map callback above.

- [ ] **Step 4: Run** — `npx tsc --noEmit -p .` and `npx vitest run` in apps/app → clean / pass.

- [ ] **Step 5: Commit** — `git commit -am "Search box shows results in stages"`

---

### Task 7: Far-away picks stay selected

**Files:**
- Modify: `apps/app/lib/map/shop-list.ts`, `apps/app/lib/map/shop-list.test.ts`, `apps/app/app/(tabs)/map.tsx`

- [ ] **Step 1: Write the failing test** (append to `shop-list.test.ts`; import `withPinned`):

```ts
describe("withPinned", () => {
  it("adds the searched shop until the area's own data includes it", () => {
    const pinned = nearby("node/9", 1, 1);
    expect(withPinned([nearby("node/1", 0, 0)], pinned).map((s) => s.externalId)).toEqual(["node/1", "node/9"]);
    expect(withPinned([nearby("node/9", 1, 1)], pinned).map((s) => s.externalId)).toEqual(["node/9"]);
    expect(withPinned([nearby("node/1", 0, 0)], null).map((s) => s.externalId)).toEqual(["node/1"]);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** in `shop-list.ts`:
```ts
// A café picked from search far from the loaded area shows (and stays selected)
// right away, before that area's OSM data arrives — then the real entry takes over.
export function withPinned(nearby: NearbyShopPin[], pinned: NearbyShopPin | null): NearbyShopPin[] {
  if (!pinned || nearby.some((s) => s.externalId === pinned.externalId)) return nearby;
  return [...nearby, pinned];
}
```

- [ ] **Step 4: Wire into `map.tsx`:**
- Import `withPinned` from the shop-list module.
- State: `const [pinnedShop, setPinnedShop] = useState<NearbyShopPin | null>(null);`
- Change the `visible` memo to use `withPinned(nearbyShops, pinnedShop)` in place of `nearbyShops` (deps include `pinnedShop`).
- `searchNearbyShop`: add `setPinnedShop(shop);`. `searchPlace`, `searchShop` and `locate`: add `setPinnedShop(null);`.
- Replace the `selectedRow` line (`const selectedRow = activeKey ? (rows.find(...) ?? null) : null;`) with a lookup that isn't limited by the list's 50-row cap:
```ts
  // Looked up in everything shown, not the capped list, so a far-away pick or a
  // shop past row 50 still gets its preview card.
  const selectedRow = useMemo(() => {
    const rated = selectedRatedShopId ? visible.rated.filter((s) => s.id === selectedRatedShopId) : [];
    const nearby = selectedNearbyExternalId ? visible.nearby.filter((s) => s.externalId === selectedNearbyExternalId) : [];
    return buildRows(rated, nearby, origin)[0] ?? null;
  }, [selectedRatedShopId, selectedNearbyExternalId, visible, origin]);
```
(Keep `activeKey` — the list still uses it.)

- [ ] **Step 5: Run** — `npx vitest run` and `npx tsc --noEmit -p .` in apps/app → pass / clean.

- [ ] **Step 6: Commit** — `git commit -am "Far-away search picks stay selected with a preview"`

---

### Task 8: Delete the Nominatim routes

**Files:**
- Delete: `apps/web/app/api/geocode/route.ts`, `apps/web/app/api/reverse-geocode/route.ts`
- Modify: `apps/web/lib/geocode.ts`, `apps/web/lib/geocode.test.ts`

- [ ] **Step 1:** Confirm nothing calls them: `grep -rn "api/geocode\|api/reverse-geocode\|toPlace\|formatAddress" apps packages --include=*.ts --include=*.tsx | grep -v node_modules | grep -v .next` → only the files being deleted/edited.
- [ ] **Step 2:** `git rm -r apps/web/app/api/geocode apps/web/app/api/reverse-geocode`.
- [ ] **Step 3:** In `apps/web/lib/geocode.ts` delete `NominatimResult`, `Place`, `formatAddress`, `toPlace` (keep `NominatimAddress`, `abbreviateState`, `abbreviateCountry`, `pickCity`, `formatShopLocation`) and rewrite the header comment: these are the address-formatting helpers used by `lib/photon.ts`. In `geocode.test.ts` delete the `formatAddress` and `toPlace` describe blocks and their imports.
- [ ] **Step 4:** `npx tsc --noEmit -p . && npx vitest run && npx eslint lib app/api` in apps/web → clean / pass.
- [ ] **Step 5: Commit** — `git commit -am "Remove the Nominatim search routes (replaced by /api/search)"`

---

### Task 9: Verify and ship

- [ ] **Step 1:** Stop dev servers; full checks: apps/web `npx tsc --noEmit -p . && npx vitest run && npx next build`; apps/app `npx tsc --noEmit -p . && npx vitest run && npx expo export -p web --output-dir /tmp/app-export`; packages/supabase `npx tsc --noEmit -p . && npx vitest run`.
- [ ] **Step 2: Live search checks** (web dev on :3107, Expo web pointed at it with `EXPO_PUBLIC_WEB_APP_URL=http://localhost:3107`): from a Nashville-biased `/api/search`, "dancing goats" returns Atlanta + Decatur shops; "atlanta" returns Atlanta, GA first; rated-shop search "muchacho" returns the Atlanta Muchacho (it's rated) regardless of location.
- [ ] **Step 3:** Tracker Status log line; merge to `main`; push; after deploy, `curl -sI` the production `/api/search?q=atlanta&lat=36.2&lng=-86.8` twice → second is `x-vercel-cache: HIT`.
