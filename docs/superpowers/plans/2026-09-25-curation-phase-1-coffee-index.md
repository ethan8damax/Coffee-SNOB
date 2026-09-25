# Curation Phase 1: Coffee Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One command (`pnpm --filter @coffeesnob/coffee-index build-index`) that turns Overture + OSM (Layercake) into a deduped, filtered, scored list of coffee places with stable `cs_` ids, written as 0.1° gzipped JSON tiles plus a report.

**Architecture:** `extract.ts` is the only network code (DuckDB over remote Parquet, cached locally). Everything else is pure functions composed in `pipeline.ts` and unit-tested with small fixtures. `build.ts` is the CLI: read inputs, run the pipeline, write `out/<date>/`.

**Tech Stack:** TypeScript, Vitest, `@duckdb/node-api` (MIT), `tsx` (MIT) to run the CLI, `@coffeesnob/supabase` for the chain blocklist, Node `zlib`/`crypto`/`fs`.

Spec: `docs/superpowers/specs/2026-09-25-curation-phase-1-coffee-index-design.md`.

---

## File map (all under `packages/coffee-index/`)

- `config.json` — tunables.
- `src/config.ts` — typed loader.
- `src/place.ts` — `SourcePlace`, `MergedPlace`, `IndexPlace` types + `fromOsm`, `fromOverture`.
- `src/dedupe.ts` — `clusterPlaces`, `mergeCluster`, name helpers.
- `src/filter.ts` — `keepPlace`.
- `src/visibility.ts` — `scorePlace`.
- `src/identity.ts` — `assignIds`.
- `src/tiles.ts` — `tileKey`, `toTiles`.
- `src/report.ts` — `buildReport`, `reportMarkdown`.
- `src/pipeline.ts` — `buildIndex` (pure).
- `src/extract.ts` — DuckDB queries + cache.
- `src/build.ts` — CLI.
- `test/*.test.ts` — one per pure module.
- `.gitignore` — `.cache/`, `out/`.

Shared test helper, used by several tests (`test/helpers.ts`):

```ts
import type { SourcePlace } from "../src/place";

export function sp(p: Partial<SourcePlace> & Pick<SourcePlace, "sourceId" | "name" | "lat" | "lng">): SourcePlace {
  return {
    address: null, locality: null, region: null, countryCode: null,
    website: null, phone: null, hours: null, category: null, cuisine: [],
    brand: null, brandWikidata: null, closed: false, datasets: [],
    ...p,
  };
}
```

---

### Task 1: Config and place types

**Files:** Create `config.json`, `src/config.ts`, `src/place.ts`, `test/place.test.ts`, `test/helpers.ts`, `.gitignore`.

- [ ] **Step 1: `config.json`**

```json
{
  "version": 1,
  "overtureCategories": ["coffee_shop", "cafe", "coffee_roastery"],
  "coffeeShopCategories": ["coffee_shop", "coffee_roastery"],
  "dedupeRadiusM": 50,
  "similarNameMin": 0.5,
  "visibility": { "multiSourceMin": 2, "multiSource": 1, "coffeeShopCategory": 1, "hoursOrWebsite": 1, "showAt": 2 },
  "chainSuggestMin": 10,
  "changeAlarm": 0.1,
  "tileStep": 0.1
}
```

- [ ] **Step 2: `src/config.ts`**

```ts
import raw from "../config.json";

// Every tunable lives in config.json (versioned with the code). Bump
// "version" when a change should show up in build reports.
export type Config = typeof raw;
export const config: Config = raw;
```

- [ ] **Step 3: failing test `test/place.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { fromOsm, fromOverture } from "../src/place";

describe("fromOsm", () => {
  it("maps a café node", () => {
    expect(fromOsm({
      type: "node", id: 123, name: "Spiller Park Coffee", amenity: "cafe", cuisine: ["coffee_shop"],
      brand: null, brand_wikidata: null, opening_hours: "Mo-Fr 07:00-15:00", website: "https://spillerpark.com",
      phone: null, lat: 33.77, lng: -84.36,
    })).toEqual({
      sourceId: "osm:node/123", name: "Spiller Park Coffee", lat: 33.77, lng: -84.36,
      address: null, locality: null, region: null, countryCode: null,
      website: "https://spillerpark.com", phone: null, hours: "Mo-Fr 07:00-15:00",
      category: "coffee_shop", cuisine: ["coffee_shop"], brand: null, brandWikidata: null,
      closed: false, datasets: ["OpenStreetMap"],
    });
  });

  it("calls a plain amenity=cafe a cafe, and drops nameless rows", () => {
    expect(fromOsm({ type: "way", id: 9, name: "Bean", amenity: "cafe", cuisine: null, brand: null, brand_wikidata: null, opening_hours: null, website: null, phone: null, lat: 1, lng: 2 })?.category).toBe("cafe");
    expect(fromOsm({ type: "node", id: 1, name: null, amenity: "cafe", cuisine: null, brand: null, brand_wikidata: null, opening_hours: null, website: null, phone: null, lat: 1, lng: 2 })).toBeNull();
  });
});

describe("fromOverture", () => {
  it("maps a place, keeping underlying datasets and closure", () => {
    const p = fromOverture({
      id: "08f2a", name: "East Pole Coffee Co", category: "coffee_shop", operating_status: "permanently_closed",
      website: null, phone: "+1 404 000 0000", brand_wikidata: null, brand_name: null,
      address: "255 Ottley Dr NE", locality: "Atlanta", region: "GA", country: "US",
      datasets: ["Foursquare", "Overture", "Overture-signals", "meta"], lat: 33.8, lng: -84.4,
    });
    expect(p).toMatchObject({
      sourceId: "ov:08f2a", category: "coffee_shop", cuisine: ["coffee_shop"], closed: true,
      locality: "Atlanta", countryCode: "US", datasets: ["Foursquare", "meta"],
    });
  });
});
```

Run: `pnpm --filter @coffeesnob/coffee-index test -- place` → FAIL (module missing).

- [ ] **Step 4: `src/place.ts`**

```ts
import { config } from "./config";

// One place as a single source describes it. Source ids: "osm:node/123",
// "osm:way/456" (shops.external_id minus the prefix), "ov:<GERS id>".
export type SourcePlace = {
  sourceId: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  locality: string | null;
  region: string | null;
  countryCode: string | null;
  website: string | null;
  phone: string | null;
  hours: string | null;
  category: string | null;
  cuisine: string[];
  brand: string | null;
  brandWikidata: string | null;
  closed: boolean;
  // Who vouches for it: "OpenStreetMap", or Overture's upstream datasets
  // (Foursquare, meta, Microsoft, …) without Overture's own bookkeeping.
  datasets: string[];
};

// A dedupe cluster folded into one place.
export type MergedPlace = Omit<SourcePlace, "sourceId"> & { sourceIds: string[] };

export type IndexPlace = MergedPlace & { id: string; visibility: "show" | "dim"; why: string[] };

export type OsmRow = {
  type: string; id: number; name: string | null; amenity: string | null; cuisine: string[] | null;
  brand: string | null; brand_wikidata: string | null; opening_hours: string | null;
  website: string | null; phone: string | null; lat: number; lng: number;
};

export type OvertureRow = {
  id: string; name: string | null; category: string | null; operating_status: string | null;
  website: string | null; phone: string | null; brand_wikidata: string | null; brand_name: string | null;
  address: string | null; locality: string | null; region: string | null; country: string | null;
  datasets: string[] | null; lat: number; lng: number;
};

export function fromOsm(r: OsmRow): SourcePlace | null {
  if (!r.name) return null;
  const cuisine = r.cuisine ?? [];
  return {
    sourceId: `osm:${r.type}/${r.id}`,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    address: null,
    locality: null,
    region: null,
    countryCode: null,
    website: r.website,
    phone: r.phone,
    hours: r.opening_hours,
    category: cuisine.includes("coffee_shop") ? "coffee_shop" : r.amenity === "cafe" ? "cafe" : null,
    cuisine,
    brand: r.brand,
    brandWikidata: r.brand_wikidata,
    closed: false,
    datasets: ["OpenStreetMap"],
  };
}

export function fromOverture(r: OvertureRow): SourcePlace | null {
  if (!r.name) return null;
  const coffeeShop = r.category !== null && config.coffeeShopCategories.includes(r.category);
  return {
    sourceId: `ov:${r.id}`,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    address: r.address,
    locality: r.locality,
    region: r.region,
    countryCode: r.country,
    website: r.website,
    phone: r.phone,
    hours: null,
    category: r.category,
    // Lets isCoffeePlace treat Overture's coffee categories like OSM's cuisine tag.
    cuisine: coffeeShop ? ["coffee_shop"] : [],
    brand: r.brand_name,
    brandWikidata: r.brand_wikidata,
    closed: r.operating_status === "permanently_closed",
    datasets: [...new Set((r.datasets ?? []).filter((d) => !d.startsWith("Overture")))],
  };
}
```

Add `test/helpers.ts` (shown above) and `.gitignore` with `.cache/` and `out/`.

- [ ] **Step 5:** run → PASS; `pnpm --filter @coffeesnob/coffee-index typecheck` → clean. Commit `coffee-index: config and source place types`.

### Task 2: Dedupe

**Files:** Create `src/dedupe.ts`, `test/dedupe.test.ts`.

- [ ] **Step 1: failing test**

```ts
import { describe, expect, it } from "vitest";
import { clusterPlaces, mergeCluster, nameKey, similarity } from "../src/dedupe";
import { sp } from "./helpers";

const M = 0.0001; // ~11 m of latitude

describe("names", () => {
  it("normalizes punctuation and quotes away", () => {
    expect(nameKey('Spiller Park Coffee "SP1"')).toBe("spiller park coffee sp1");
    expect(similarity("East Pole Coffee Co", "East Pole Coffee Co.")).toBe(1);
    expect(similarity("Refuge Coffee Co. Midtown", "Refuge Coffee")).toBeGreaterThanOrEqual(0.5);
    expect(similarity("Starbucks", "Refuge Coffee")).toBe(0);
  });
});

describe("clusterPlaces", () => {
  it("merges the same café from two sources a few metres apart", () => {
    const c = clusterPlaces([
      sp({ sourceId: "osm:node/1", name: "East Pole Coffee Co", lat: 33.8, lng: -84.4 }),
      sp({ sourceId: "ov:a", name: "East Pole Coffee Co.", lat: 33.8 + 2 * M, lng: -84.4 }),
    ], 50, 0.5);
    expect(c).toHaveLength(1);
  });

  it("merges a leading-words match (branch suffix)", () => {
    const c = clusterPlaces([
      sp({ sourceId: "osm:node/1", name: "Spiller Park Coffee", lat: 33.77, lng: -84.36 }),
      sp({ sourceId: "ov:b", name: 'Spiller Park Coffee "SP1"', lat: 33.77, lng: -84.36 + M }),
    ], 50, 0.5);
    expect(c).toHaveLength(1);
  });

  it("merges merely similar names only when website or phone match", () => {
    const a = sp({ sourceId: "osm:node/1", name: "Refuge Coffee", lat: 1, lng: 1, website: "https://refugecoffeeco.com/" });
    const b = sp({ sourceId: "ov:c", name: "Refuge Coffee Co. Midtown", lat: 1 + M, lng: 1, website: "http://www.refugecoffeeco.com/midtown" });
    expect(clusterPlaces([a, b], 50, 0.5)).toHaveLength(1);
    expect(clusterPlaces([a, { ...b, website: null }], 50, 0.5)).toHaveLength(2);
  });

  it("keeps different names apart, and same names far apart", () => {
    expect(clusterPlaces([
      sp({ sourceId: "osm:node/1", name: "Starbucks", lat: 1, lng: 1 }),
      sp({ sourceId: "osm:node/2", name: "Refuge Coffee", lat: 1, lng: 1 }),
    ], 50, 0.5)).toHaveLength(2);
    expect(clusterPlaces([
      sp({ sourceId: "osm:node/1", name: "Refuge Coffee", lat: 1, lng: 1 }),
      sp({ sourceId: "osm:node/2", name: "Refuge Coffee", lat: 1 + 10 * M, lng: 1 }),
    ], 50, 0.5)).toHaveLength(2);
  });

  it("finds neighbours across a cell edge at high latitude", () => {
    const c = clusterPlaces([
      sp({ sourceId: "osm:node/1", name: "Kaffebrenneriet", lat: 69.649, lng: 18.955 }),
      sp({ sourceId: "ov:d", name: "Kaffebrenneriet", lat: 69.649, lng: 18.9559 }),
    ], 50, 0.5);
    expect(c).toHaveLength(1);
  });
});

describe("mergeCluster", () => {
  it("takes names/addresses from Overture, hours and position from OSM", () => {
    const m = mergeCluster([
      sp({ sourceId: "ov:a", name: "East Pole Coffee Co.", lat: 33.80002, lng: -84.4, address: "255 Ottley Dr", locality: "Atlanta", countryCode: "US", category: "coffee_shop", datasets: ["Foursquare"] }),
      sp({ sourceId: "osm:node/1", name: "East Pole", lat: 33.8, lng: -84.4, hours: "Mo-Su 08:00-16:00", category: "cafe", datasets: ["OpenStreetMap"] }),
    ]);
    expect(m).toMatchObject({
      sourceIds: ["ov:a", "osm:node/1"], name: "East Pole Coffee Co.", lat: 33.8, address: "255 Ottley Dr",
      hours: "Mo-Su 08:00-16:00", category: "coffee_shop", datasets: ["Foursquare", "OpenStreetMap"], closed: false,
    });
  });

  it("is closed only when every Overture record says so", () => {
    expect(mergeCluster([sp({ sourceId: "ov:a", name: "X", lat: 1, lng: 1, closed: true })]).closed).toBe(true);
    expect(mergeCluster([
      sp({ sourceId: "ov:a", name: "X", lat: 1, lng: 1, closed: true }),
      sp({ sourceId: "ov:b", name: "X", lat: 1, lng: 1 }),
    ]).closed).toBe(false);
  });
});
```

Run → FAIL.

- [ ] **Step 2: `src/dedupe.ts`**

```ts
import { normalizeChainName } from "./index";
import type { MergedPlace, SourcePlace } from "./place";

const EARTH_M_PER_DEG = 111_320;

export const nameKey = (name: string) => normalizeChainName(name);

// Share of words the shorter name has in common with the longer one.
export function similarity(a: string, b: string): number {
  const wa = new Set(nameKey(a).split(" ").filter(Boolean));
  const wb = new Set(nameKey(b).split(" ").filter(Boolean));
  if (!wa.size || !wb.size) return 0;
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared / Math.min(wa.size, wb.size) >= 1 && wa.size === wb.size ? 1 : shared / Math.max(wa.size, wb.size);
}

function nearIdentical(a: string, b: string): boolean {
  const ka = nameKey(a);
  const kb = nameKey(b);
  return ka === kb || ka.startsWith(kb + " ") || kb.startsWith(ka + " ");
}

const domain = (url: string | null) =>
  url ? url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0] : null;
const digits = (phone: string | null) => (phone ? phone.replace(/\D/g, "").slice(-9) : null);

function distanceM(a: SourcePlace, b: SourcePlace): number {
  const dLat = (a.lat - b.lat) * EARTH_M_PER_DEG;
  const dLng = (a.lng - b.lng) * EARTH_M_PER_DEG * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLng);
}

function sameCafe(a: SourcePlace, b: SourcePlace, radiusM: number, similarMin: number): boolean {
  if (distanceM(a, b) > radiusM) return false;
  if (nearIdentical(a.name, b.name)) return true;
  if (similarity(a.name, b.name) < similarMin) return false;
  const da = domain(a.website);
  const pa = digits(a.phone);
  return (da !== null && da === domain(b.website)) || (pa !== null && pa.length >= 7 && pa === digits(b.phone));
}

// Groups records that describe the same café. Conservative on purpose: when
// unsure, two dots beat one wrong merge.
// ponytail: grid buckets + union-find, O(n) for real densities. Ceiling: a
// cell with thousands of same-spot records goes quadratic; none seen so far.
export function clusterPlaces(places: SourcePlace[], radiusM: number, similarMin: number): SourcePlace[][] {
  const cell = radiusM / EARTH_M_PER_DEG;
  const key = (x: number, y: number) => `${x}:${y}`;
  const grid = new Map<string, number[]>();
  places.forEach((p, i) => {
    const k = key(Math.floor(p.lat / cell), Math.floor(p.lng / cell));
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(i);
  });

  const parent = places.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));

  places.forEach((p, i) => {
    const cy = Math.floor(p.lat / cell);
    const cx = Math.floor(p.lng / cell);
    // Longitude cells shrink toward the poles, so look further sideways there.
    const span = Math.ceil(1 / Math.max(Math.cos(p.lat * (Math.PI / 180)), 0.05));
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -span; dx <= span; dx++) {
        for (const j of grid.get(key(cy + dy, cx + dx)) ?? []) {
          if (j <= i || find(i) === find(j)) continue;
          if (sameCafe(p, places[j], radiusM, similarMin)) parent[find(j)] = find(i);
        }
      }
    }
  });

  const groups = new Map<number, SourcePlace[]>();
  places.forEach((p, i) => {
    const r = find(i);
    (groups.get(r) ?? groups.set(r, []).get(r)!).push(p);
  });
  return [...groups.values()];
}

const first = <T>(xs: T[]) => xs.find((x) => x !== null && x !== undefined) ?? null;

// Overture first for names and addresses (it carries them), OSM first for
// hours and position (mappers place the pin on the door).
export function mergeCluster(cluster: SourcePlace[]): MergedPlace {
  const ov = cluster.filter((p) => p.sourceId.startsWith("ov:"));
  const osm = cluster.filter((p) => p.sourceId.startsWith("osm:"));
  const ovFirst = [...ov, ...osm];
  const osmFirst = [...osm, ...ov];
  const categories = cluster.map((p) => p.category);
  return {
    sourceIds: ovFirst.map((p) => p.sourceId),
    name: ovFirst[0].name,
    lat: osmFirst[0].lat,
    lng: osmFirst[0].lng,
    address: first(ovFirst.map((p) => p.address)),
    locality: first(ovFirst.map((p) => p.locality)),
    region: first(ovFirst.map((p) => p.region)),
    countryCode: first(ovFirst.map((p) => p.countryCode)),
    website: first(ovFirst.map((p) => p.website)),
    phone: first(ovFirst.map((p) => p.phone)),
    hours: first(osmFirst.map((p) => p.hours)),
    category: categories.includes("coffee_shop") ? "coffee_shop" : first(categories),
    cuisine: [...new Set(cluster.flatMap((p) => p.cuisine))],
    brand: first(ovFirst.map((p) => p.brand)),
    brandWikidata: first(ovFirst.map((p) => p.brandWikidata)),
    closed: ov.length > 0 && ov.every((p) => p.closed),
    datasets: [...new Set(ovFirst.flatMap((p) => p.datasets))],
  };
}
```

Note `similarity` returns 1 only for identical word sets, else shared/max-words. Run → PASS. Commit `coffee-index: dedupe`.

### Task 3: Filter and visibility

**Files:** Create `src/filter.ts`, `src/visibility.ts`, `test/filter.test.ts`, `test/visibility.test.ts`.

- [ ] **Step 1: failing tests**

```ts
// test/filter.test.ts
import { describe, expect, it } from "vitest";
import { keepPlace } from "../src/filter";
import { mergeCluster } from "../src/dedupe";
import { sp } from "./helpers";

const chains = [{ name: "starbucks", wikidata: "Q37158" }, { name: "dunkin", wikidata: null }];
const m = (p: Parameters<typeof sp>[0]) => mergeCluster([sp(p)]);

describe("keepPlace", () => {
  it("keeps an independent coffee shop", () => {
    expect(keepPlace(m({ sourceId: "osm:node/1", name: "Spiller Park Coffee", lat: 1, lng: 1 }), chains)).toBe(true);
  });
  it("drops chains by name, brand, or brand ID", () => {
    expect(keepPlace(m({ sourceId: "ov:a", name: "Starbucks Coffee Company", lat: 1, lng: 1, brandWikidata: "Q37158" }), chains)).toBe(false);
    expect(keepPlace(m({ sourceId: "ov:b", name: "Dunkin' Donuts", lat: 1, lng: 1 }), chains)).toBe(false);
    expect(keepPlace(m({ sourceId: "osm:node/2", name: "Midtown Plaza", lat: 1, lng: 1, brand: "Dunkin" }), chains)).toBe(false);
  });
  it("drops tea shops and closed places", () => {
    expect(keepPlace(m({ sourceId: "osm:node/3", name: "Kung Fu Tea", lat: 1, lng: 1, cuisine: ["bubble_tea"] }), chains)).toBe(false);
    expect(keepPlace(m({ sourceId: "ov:c", name: "Gone Coffee", lat: 1, lng: 1, closed: true }), chains)).toBe(false);
  });
});
```

```ts
// test/visibility.test.ts
import { describe, expect, it } from "vitest";
import { scorePlace } from "../src/visibility";
import { mergeCluster } from "../src/dedupe";
import { sp } from "./helpers";

describe("scorePlace", () => {
  it("shows a coffee shop that two sources agree on, and says why", () => {
    const p = mergeCluster([
      sp({ sourceId: "ov:a", name: "Perc", lat: 1, lng: 1, category: "coffee_shop", datasets: ["Foursquare"] }),
      sp({ sourceId: "osm:node/1", name: "Perc", lat: 1, lng: 1, datasets: ["OpenStreetMap"] }),
    ]);
    expect(scorePlace(p)).toEqual({ visibility: "show", why: ["in 2 sources", "listed as a coffee shop"] });
  });
  it("dims a generic café seen once", () => {
    expect(scorePlace(mergeCluster([sp({ sourceId: "osm:node/1", name: "Bakery Café", lat: 1, lng: 1, category: "cafe", datasets: ["OpenStreetMap"] })])))
      .toEqual({ visibility: "dim", why: [] });
  });
  it("counts hours or a website once", () => {
    const p = mergeCluster([sp({ sourceId: "osm:node/1", name: "X", lat: 1, lng: 1, category: "coffee_shop", hours: "24/7", website: "x.com", datasets: ["OpenStreetMap"] })]);
    expect(scorePlace(p)).toEqual({ visibility: "show", why: ["listed as a coffee shop", "has hours or a website"] });
  });
});
```

Run → FAIL.

- [ ] **Step 2: implementations**

```ts
// src/filter.ts
import { isChain, isCoffeePlace, type ChainEntry } from "./index";
import type { MergedPlace } from "./place";

// Same rules as the live map (isCoffeePlace, isChain), applied to the merged
// place. Overrides and user flags join in Phase 3.
export function keepPlace(p: MergedPlace, chains: ChainEntry[]): boolean {
  if (p.closed) return false;
  if (!isCoffeePlace({ name: p.name, cuisine: p.cuisine.join(";") })) return false;
  const tags: Record<string, string> = { name: p.name };
  if (p.brand) tags.brand = p.brand;
  if (p.brandWikidata) tags["brand:wikidata"] = p.brandWikidata;
  return !isChain(tags, chains);
}
```

```ts
// src/visibility.ts
import { config } from "./config";
import type { MergedPlace } from "./place";

// How loudly an unrated place shows (parent spec 5.1). Never hides: hiding is
// for filters, overrides and flags. Roaster and flag signals arrive in later
// phases.
export function scorePlace(p: MergedPlace): { visibility: "show" | "dim"; why: string[] } {
  const v = config.visibility;
  const why: string[] = [];
  let points = 0;
  if (p.datasets.length >= v.multiSourceMin) {
    points += v.multiSource;
    why.push(`in ${p.datasets.length} sources`);
  }
  if (p.category && config.coffeeShopCategories.includes(p.category)) {
    points += v.coffeeShopCategory;
    why.push("listed as a coffee shop");
  }
  if (p.hours || p.website) {
    points += v.hoursOrWebsite;
    why.push("has hours or a website");
  }
  return { visibility: points >= v.showAt ? "show" : "dim", why: points >= v.showAt ? why : [] };
}
```

Note: `why` is empty for dim places — nothing worth explaining. Run → PASS. Commit `coffee-index: filter and visibility`.

### Task 4: Stable identity

**Files:** Create `src/identity.ts`, `test/identity.test.ts`.

- [ ] **Step 1: failing test**

```ts
import { describe, expect, it } from "vitest";
import { assignIds } from "../src/identity";

describe("assignIds", () => {
  it("makes cs_ ids from the Overture id first, else OSM", () => {
    const { ids } = assignIds([["ov:a", "osm:node/1"], ["osm:node/2"]], {});
    expect(ids[0]).toMatch(/^cs_[0-9a-f]{12}$/);
    expect(ids[0]).not.toBe(ids[1]);
    expect(assignIds([["osm:node/1", "ov:a"]], {}).ids[0]).toBe(ids[0]);
  });

  it("keeps an old id when any source id was seen before", () => {
    const first = assignIds([["osm:node/1"]], {});
    const second = assignIds([["ov:new", "osm:node/1"]], first.idMap);
    expect(second.ids[0]).toBe(first.ids[0]);
    expect(second.idMap["ov:new"]).toBe(first.ids[0]);
  });

  it("gives a split-off cluster a fresh id, not a duplicate", () => {
    const prev = { "osm:node/1": "cs_aaaaaaaaaaaa", "osm:node/2": "cs_aaaaaaaaaaaa" };
    const { ids } = assignIds([["osm:node/1"], ["osm:node/2"]], prev);
    expect(ids[0]).toBe("cs_aaaaaaaaaaaa");
    expect(ids[1]).not.toBe("cs_aaaaaaaaaaaa");
  });

  it("remembers vanished sources so a comeback keeps its id", () => {
    const { idMap } = assignIds([], { "osm:node/9": "cs_bbbbbbbbbbbb" });
    expect(idMap["osm:node/9"]).toBe("cs_bbbbbbbbbbbb");
  });
});
```

- [ ] **Step 2: `src/identity.ts`**

```ts
import { createHash } from "node:crypto";

const anchor = (sourceIds: string[]) => sourceIds.find((s) => s.startsWith("ov:")) ?? [...sourceIds].sort()[0];
const hashId = (s: string) => `cs_${createHash("sha1").update(s).digest("hex").slice(0, 12)}`;

// A place's cs_ id must survive monthly rebuilds: shops.external_id points at
// it once someone logs a visit. Any source id seen before hands its old id
// on; new places hash their anchor source id.
export function assignIds(clusters: string[][], prev: Record<string, string>): { ids: string[]; idMap: Record<string, string> } {
  const used = new Set<string>();
  const idMap: Record<string, string> = { ...prev };
  const ids = clusters.map((sourceIds) => {
    let id = sourceIds.map((s) => prev[s]).find((old) => old && !used.has(old));
    if (!id) {
      const base = anchor(sourceIds);
      id = hashId(base);
      for (let n = 1; used.has(id) || (Object.values(prev).includes(id) && !sourceIds.some((s) => prev[s] === id)); n++) id = hashId(`${base}#${n}`);
    }
    used.add(id);
    for (const s of sourceIds) idMap[s] = id;
    return id;
  });
  return { ids, idMap };
}
```

Performance note: `Object.values(prev).includes` is O(n) per new id; build a `Set` of prev values once instead:

```ts
  const prevIds = new Set(Object.values(prev));
  // …and in the loop condition use prevIds.has(id)
```

Use the Set version. Run → PASS. Commit `coffee-index: stable cs_ ids`.

### Task 5: Tiles and report

**Files:** Create `src/tiles.ts`, `src/report.ts`, `test/tiles.test.ts`, `test/report.test.ts`.

- [ ] **Step 1: failing tests**

```ts
// test/tiles.test.ts
import { describe, expect, it } from "vitest";
import { tileKey, toTiles } from "../src/tiles";

describe("tiles", () => {
  it("keys by the cell's south-west corner on the app's 0.1° grid", () => {
    expect(tileKey(33.77, -84.36, 0.1)).toBe("33.7_-84.4");
    expect(tileKey(-33.87, 151.21, 0.1)).toBe("-33.9_151.2");
    expect(tileKey(33.7, -84.4, 0.1)).toBe("33.7_-84.4");
  });
  it("groups places into their cells", () => {
    const t = toTiles([{ id: "cs_1", lat: 33.77, lng: -84.36 }, { id: "cs_2", lat: 33.71, lng: -84.39 }, { id: "cs_3", lat: 40.7, lng: -74 }], 0.1);
    expect([...t.keys()].sort()).toEqual(["33.7_-84.4", "40.7_-74"]);
    expect(t.get("33.7_-84.4")).toHaveLength(2);
  });
});
```

```ts
// test/report.test.ts
import { describe, expect, it } from "vitest";
import { buildReport } from "../src/report";

const place = (id: string, countryCode: string, name = id, brandWikidata: string | null = null) => ({ id, countryCode, name, brandWikidata });

describe("buildReport", () => {
  it("counts by country and diffs against the previous build", () => {
    const r = buildReport([place("a", "US"), place("b", "US"), place("c", "GB")], new Set(["a", "z"]), []);
    expect(r.byCountry).toEqual({ US: 2, GB: 1 });
    expect(r).toMatchObject({ count: 3, added: 2, removed: 1 });
  });
  it("raises the alarm past 10% churn, and not on a first build", () => {
    expect(buildReport([place("a", "US"), place("b", "US")], new Set(["a"]), []).alarm).toMatch(/added/);
    expect(buildReport([place("a", "US")], null, []).alarm).toBeNull();
  });
  it("suggests names with more than 10 places in one country", () => {
    const many = Array.from({ length: 11 }, (_, i) => place(`p${i}`, "US", "Joe's Coffee"));
    expect(buildReport(many, null, []).suggestedChains).toEqual([{ key: "joes coffee", name: "Joe's Coffee", countryCode: "US", count: 11 }]);
  });
});
```

- [ ] **Step 2: implementations**

```ts
// src/tiles.ts
// Same grid as the app's snapToGrid (apps/app/lib/map/bounds.ts), so a
// viewport maps to a handful of tile URLs.
const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function tileKey(lat: number, lng: number, step: number): string {
  const snap = (n: number) => round(Math.floor(round(n / step)) * step);
  return `${snap(lat)}_${snap(lng)}`;
}

export function toTiles<T extends { lat: number; lng: number }>(places: T[], step: number): Map<string, T[]> {
  const tiles = new Map<string, T[]>();
  for (const p of places) {
    const k = tileKey(p.lat, p.lng, step);
    (tiles.get(k) ?? tiles.set(k, []).get(k)!).push(p);
  }
  return tiles;
}
```

```ts
// src/report.ts
import { config } from "./config";
import { isChain, normalizeChainName, type ChainEntry } from "./index";

type Reportable = { id: string; countryCode: string | null; name: string; brandWikidata: string | null };

export type Report = {
  count: number;
  byCountry: Record<string, number>;
  added: number | null;
  removed: number | null;
  suggestedChains: { key: string; name: string; countryCode: string; count: number }[];
  alarm: string | null;
};

export function buildReport(places: Reportable[], prevIds: Set<string> | null, chains: ChainEntry[]): Report {
  const byCountry: Record<string, number> = {};
  for (const p of places) byCountry[p.countryCode ?? "??"] = (byCountry[p.countryCode ?? "??"] ?? 0) + 1;

  let added: number | null = null;
  let removed: number | null = null;
  let alarm: string | null = null;
  if (prevIds) {
    const ids = new Set(places.map((p) => p.id));
    added = places.filter((p) => !prevIds.has(p.id)).length;
    removed = [...prevIds].filter((id) => !ids.has(id)).length;
    const base = Math.max(prevIds.size, 1);
    if (added / base > config.changeAlarm) alarm = `${added} places added (${Math.round((added / base) * 100)}%)`;
    else if (removed / base > config.changeAlarm) alarm = `${removed} places removed (${Math.round((removed / base) * 100)}%)`;
  }

  // Candidate chains: the same brand ID or name more than N times in one
  // country, not already blocked. The admin decides (Phase 3).
  const groups = new Map<string, { key: string; name: string; countryCode: string; count: number }>();
  for (const p of places) {
    if (!p.countryCode) continue;
    const key = p.brandWikidata ?? normalizeChainName(p.name);
    const g = groups.get(`${p.countryCode}|${key}`) ?? { key, name: p.name, countryCode: p.countryCode, count: 0 };
    g.count++;
    groups.set(`${p.countryCode}|${key}`, g);
  }
  const suggestedChains = [...groups.values()]
    .filter((g) => g.count > config.chainSuggestMin && !isChain({ name: g.name }, chains))
    .sort((a, b) => b.count - a.count);

  return { count: places.length, byCountry, added, removed, suggestedChains, alarm };
}

export function reportMarkdown(r: Report, meta: { builtAt: string; sources: Record<string, string> }): string {
  const countries = Object.entries(r.byCountry).sort((a, b) => b[1] - a[1]).slice(0, 30);
  return [
    `# Coffee index build ${meta.builtAt}`,
    "",
    `Sources: ${Object.entries(meta.sources).map(([k, v]) => `${k} ${v}`).join(", ")}`,
    `Places: ${r.count}` + (r.added === null ? " (first build)" : ` (+${r.added} / -${r.removed})`),
    r.alarm ? `\n**ALARM:** ${r.alarm}` : "",
    "",
    "## Top countries",
    ...countries.map(([c, n]) => `- ${c}: ${n}`),
    "",
    `## Suggested chains (${r.suggestedChains.length})`,
    ...r.suggestedChains.slice(0, 100).map((g) => `- ${g.name} (${g.countryCode}, ${g.count})${g.key.startsWith("Q") ? ` ${g.key}` : ""}`),
  ].join("\n");
}
```

Run → PASS. Commit `coffee-index: tiles and build report`.

### Task 6: Pipeline

**Files:** Create `src/pipeline.ts`, `test/pipeline.test.ts`.

- [ ] **Step 1: failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildIndex } from "../src/pipeline";

const osm = (id: number, name: string, lat: number, lng: number, extra: Record<string, unknown> = {}) => ({
  type: "node", id, name, amenity: "cafe", cuisine: null, brand: null, brand_wikidata: null,
  opening_hours: null, website: null, phone: null, lat, lng, ...extra,
});
const ov = (id: string, name: string, lat: number, lng: number, extra: Record<string, unknown> = {}) => ({
  id, name, category: "coffee_shop", operating_status: "open", website: null, phone: null,
  brand_wikidata: null, brand_name: null, address: null, locality: "Atlanta", region: "GA", country: "US",
  datasets: ["Foursquare"], lat, lng, ...extra,
});

describe("buildIndex", () => {
  const input = {
    osm: [osm(1, "East Pole Coffee Co", 33.8, -84.4), osm(2, "Kung Fu Tea", 33.75, -84.38, { cuisine: ["bubble_tea"] })],
    overture: [ov("a", "East Pole Coffee Co.", 33.80001, -84.4), ov("b", "Starbucks", 33.76, -84.38, { brand_wikidata: "Q37158" })],
    chains: [{ name: "starbucks", wikidata: "Q37158" }],
    prevIdMap: {},
    prevIds: null,
  };

  it("merges, filters and scores end to end", () => {
    const { places, report } = buildIndex(input);
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ name: "East Pole Coffee Co.", sourceIds: ["ov:a", "osm:node/1"], visibility: "show", locality: "Atlanta" });
    expect(report.count).toBe(1);
  });

  it("keeps ids stable across two builds", () => {
    const one = buildIndex(input);
    const two = buildIndex({ ...input, prevIdMap: one.idMap, prevIds: new Set(one.places.map((p) => p.id)) });
    expect(two.places[0].id).toBe(one.places[0].id);
    expect(two.report).toMatchObject({ added: 0, removed: 0, alarm: null });
  });
});
```

- [ ] **Step 2: `src/pipeline.ts`**

```ts
import { config } from "./config";
import { clusterPlaces, mergeCluster } from "./dedupe";
import { keepPlace } from "./filter";
import { assignIds } from "./identity";
import type { ChainEntry } from "./index";
import { fromOsm, fromOverture, type IndexPlace, type OsmRow, type OvertureRow, type SourcePlace } from "./place";
import { buildReport, type Report } from "./report";
import { scorePlace } from "./visibility";

export type BuildInput = {
  osm: OsmRow[];
  overture: OvertureRow[];
  chains: ChainEntry[];
  prevIdMap: Record<string, string>;
  prevIds: Set<string> | null;
};

// The whole index build minus I/O: normalise → dedupe → filter → score → ids.
export function buildIndex(input: BuildInput): { places: IndexPlace[]; idMap: Record<string, string>; report: Report } {
  const sources = [...input.overture.map(fromOverture), ...input.osm.map(fromOsm)].filter((p): p is SourcePlace => p !== null);
  const merged = clusterPlaces(sources, config.dedupeRadiusM, config.similarNameMin)
    .map(mergeCluster)
    .filter((p) => keepPlace(p, input.chains));
  const { ids, idMap } = assignIds(merged.map((p) => p.sourceIds), input.prevIdMap);
  const places = merged.map((p, i) => ({ ...p, id: ids[i], ...scorePlace(p) }));
  return { places, idMap, report: buildReport(places, input.prevIds, input.chains) };
}
```

Note: ids are assigned only to kept places, so a chain's source ids never claim a `cs_` id. Run → PASS. Commit `coffee-index: pipeline`.

### Task 7: Extract (DuckDB) and CLI

**Files:** Create `src/extract.ts`, `src/build.ts`; modify `package.json`.

- [ ] **Step 1: dependencies and script**

Run: `pnpm --filter @coffeesnob/coffee-index add @duckdb/node-api @coffeesnob/supabase@workspace:* && pnpm --filter @coffeesnob/coffee-index add -D tsx`
Add script `"build-index": "tsx src/build.ts"`.

- [ ] **Step 2: `src/extract.ts`**

```ts
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { config } from "./config";
import type { OsmRow, OvertureRow } from "./place";

// The only network code in the index build. DuckDB reads just the columns
// and row groups a query needs from each source's remote Parquet, so a
// worldwide coffee extract moves a small slice of each dataset, then caches
// it per source version.
export type BBox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

const LAYERCAKE = "https://data.openstreetmap.us/layercake";
const OVERTURE_STAC = "https://stac.overturemaps.org/catalog.json";

export async function sourceVersions(): Promise<{ layercake: string; overture: string }> {
  const [lc, ov] = await Promise.all([
    fetch(`${LAYERCAKE}/metadata.json`).then((r) => r.json() as Promise<{ timestamp: string }>),
    fetch(OVERTURE_STAC).then((r) => r.json() as Promise<{ latest: string }>),
  ]);
  return { layercake: lc.timestamp, overture: ov.latest };
}

const bboxSql = (b: BBox | undefined) =>
  b ? ` and bbox.xmin >= ${b.minLng} and bbox.xmax <= ${b.maxLng} and bbox.ymin >= ${b.minLat} and bbox.ymax <= ${b.maxLat}` : "";
const bboxTag = (b: BBox | undefined) => (b ? `-${b.minLng}_${b.minLat}_${b.maxLng}_${b.maxLat}` : "-world");
const list = (xs: string[]) => xs.map((x) => `'${x.replace(/'/g, "''")}'`).join(", ");

async function cached<T>(cacheDir: string, file: string, query: string): Promise<T[]> {
  mkdirSync(cacheDir, { recursive: true });
  const path = join(cacheDir, file);
  const db = await DuckDBInstance.create(":memory:");
  const c = await db.connect();
  await c.run("install httpfs; load httpfs; set s3_region='us-west-2';");
  if (!existsSync(path)) {
    const tmp = `${path}.tmp`;
    await c.run(`copy (${query}) to '${tmp}' (format parquet)`);
    const { renameSync } = await import("node:fs");
    renameSync(tmp, path); // only a finished extract becomes the cache
  }
  const reader = await c.runAndReadAll(`select * from '${path}'`);
  return reader.getRowObjectsJson() as unknown as T[];
}

export function extractOsm(version: string, cacheDir: string, bbox?: BBox): Promise<OsmRow[]> {
  return cached<OsmRow>(cacheDir, `osm-${version.replace(/[:]/g, "")}${bboxTag(bbox)}.parquet`, `
    select type, id, name[1] as name, amenity, cuisine, brand, "brand:wikidata" as brand_wikidata,
      opening_hours, website, phone,
      (bbox.ymin + bbox.ymax) / 2 as lat, (bbox.xmin + bbox.xmax) / 2 as lng
    from read_parquet('${LAYERCAKE}/pois.parquet')
    where (amenity = 'cafe' or list_contains(cuisine, 'coffee_shop'))${bboxSql(bbox)}`);
}

export function extractOverture(release: string, cacheDir: string, bbox?: BBox): Promise<OvertureRow[]> {
  return cached<OvertureRow>(cacheDir, `overture-${release}${bboxTag(bbox)}.parquet`, `
    select id, names."primary" as name, taxonomy."primary" as category, operating_status,
      websites[1] as website, phones[1] as phone,
      brand.wikidata as brand_wikidata, brand.names."primary" as brand_name,
      addresses[1].freeform as address, addresses[1].locality as locality,
      addresses[1].region as region, addresses[1].country as country,
      list_transform(sources, s -> s.dataset) as datasets,
      (bbox.ymin + bbox.ymax) / 2 as lat, (bbox.xmin + bbox.xmax) / 2 as lng
    from read_parquet('s3://overturemaps-us-west-2/release/${release}/theme=places/type=place/*')
    where (taxonomy."primary" in (${list(config.overtureCategories)}) or basic_category in ('coffee_shop', 'cafe'))${bboxSql(bbox)}`);
}
```

Move the `renameSync` import to the top-level `node:fs` import when writing it (shown inline here only for clarity of intent).

- [ ] **Step 3: `src/build.ts`**

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { gunzipSync, gzipSync } from "node:zlib";
import { createSupabaseClient, getChainBlocklist } from "@coffeesnob/supabase";
import { config } from "./config";
import { extractOsm, extractOverture, sourceVersions, type BBox } from "./extract";
import { buildIndex } from "./pipeline";
import type { IndexPlace } from "./place";
import { reportMarkdown } from "./report";
import { toTiles } from "./tiles";

// pnpm --filter @coffeesnob/coffee-index build-index [--bbox minLng,minLat,maxLng,maxLat]
//   [--prev out/<earlier>] [--out out] [--first-run] [--allow-big-change]
const { values } = parseArgs({
  options: {
    bbox: { type: "string" },
    prev: { type: "string" },
    out: { type: "string", default: "out" },
    "first-run": { type: "boolean", default: false },
    "allow-big-change": { type: "boolean", default: false },
  },
});

const bbox: BBox | undefined = values.bbox
  ? (([minLng, minLat, maxLng, maxLat]) => ({ minLng, minLat, maxLng, maxLat }))(values.bbox.split(",").map(Number))
  : undefined;

if (!values.prev && !values["first-run"]) {
  console.error("No --prev build given. Pass the last build's folder so ids stay stable, or --first-run for the very first build.");
  process.exit(1);
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_ANON_KEY are required (the chain blocklist is public-read).");
  process.exit(1);
}

const started = Date.now();
const versions = await sourceVersions();
console.log("sources", versions);
const cacheDir = resolve(".cache");
const [osm, overture, chains] = await Promise.all([
  extractOsm(versions.layercake, cacheDir, bbox),
  extractOverture(versions.overture, cacheDir, bbox),
  getChainBlocklist(createSupabaseClient(url, key)),
]);
console.log(`extracted osm=${osm.length} overture=${overture.length} chains=${chains.length} in ${Math.round((Date.now() - started) / 1000)}s`);

const prevDir = values.prev ? resolve(values.prev) : null;
const prevIdMap: Record<string, string> = prevDir ? JSON.parse(readFileSync(join(prevDir, "id_map.json"), "utf8")) : {};
const prevIds = prevDir
  ? new Set(gunzipSync(readFileSync(join(prevDir, "places.ndjson.gz"))).toString("utf8").split("\n").filter(Boolean).map((l) => (JSON.parse(l) as IndexPlace).id))
  : null;

const { places, idMap, report } = buildIndex({ osm, overture, chains, prevIdMap, prevIds });
const builtAt = new Date().toISOString();
const outDir = resolve(values.out!, builtAt.slice(0, 10) + (bbox ? "-bbox" : ""));
mkdirSync(join(outDir, "tiles"), { recursive: true });

writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
writeFileSync(join(outDir, "report.md"), reportMarkdown(report, { builtAt, sources: versions }));
if (report.alarm && !values["allow-big-change"]) {
  console.error(`ALARM: ${report.alarm}. Tiles not written. Check report.md, then rerun with --allow-big-change if it's real.`);
  process.exit(2);
}

// Tile entries: what the map needs per dot (parent spec 4.3).
const entry = (p: IndexPlace) => ({
  id: p.id, sourceIds: p.sourceIds, name: p.name, lat: p.lat, lng: p.lng,
  address: p.address, locality: p.locality, region: p.region, countryCode: p.countryCode,
  website: p.website, phone: p.phone, hours: p.hours, visibility: p.visibility, why: p.why,
});
for (const [k, ps] of toTiles(places, config.tileStep)) {
  writeFileSync(join(outDir, "tiles", `${k}.json.gz`), gzipSync(JSON.stringify(ps.map(entry))));
}
writeFileSync(join(outDir, "places.ndjson.gz"), gzipSync(places.map((p) => JSON.stringify(p)).join("\n")));
writeFileSync(join(outDir, "id_map.json"), JSON.stringify(idMap));
writeFileSync(join(outDir, "manifest.json"), JSON.stringify({ version: builtAt.slice(0, 10), builtAt, configVersion: config.version, sources: versions, bbox: bbox ?? null, count: places.length }, null, 2));
console.log(`built ${places.length} places into ${outDir} in ${Math.round((Date.now() - started) / 1000)}s`);
if (!existsSync(join(outDir, "manifest.json"))) process.exit(1);
```

- [ ] **Step 3b:** `pnpm --filter @coffeesnob/coffee-index typecheck`. `@duckdb/node-api`'s `getRowObjectsJson` returns JSON-safe values (numbers as numbers or strings for BIGINT — OSM `id` may arrive as a string; `fromOsm` only interpolates it, so either works). Commit `coffee-index: extract and build CLI`.

### Task 8: Pilot (Atlanta) and a worldwide run

- [ ] **Step 1: first pilot build**

Run (env from `apps/web/.env.local`):
```bash
cd packages/coffee-index
set -a; source ../../apps/web/.env.local; set +a
pnpm build-index --bbox -84.6,33.6,-84.2,34.0 --first-run --out out/pilot-1
```
Expected: prints source versions, extract counts (OSM ~361), built N places.

- [ ] **Step 2: inspect.** `zcat out/pilot-1/*/places.ndjson.gz | jq -r '[.name,.visibility,(.sourceIds|length)]|@tsv' | sort | less`. Check: Spiller Park, East Pole, Muchacho present; no Starbucks/Dunkin/Kung Fu Tea; look for obvious double dots (same name twice within a block). Record numbers and any misses in the tracker. Fix real rule bugs with a failing test first.
- [ ] **Step 3: second pilot build** with `--prev out/pilot-1/<dir> --out out/pilot-2`. Expected: `added 0 / removed 0` (same source versions), same ids.
- [ ] **Step 4: worldwide build** `pnpm build-index --first-run --out out/world` (background; minutes). Record runtime, place count, tile count and total size, top countries, and the top suggested chains in the tracker.
- [ ] **Step 5: Tracker** — check nothing off Phase 1 until the pilot looks right; add a Status line with the pilot and worldwide numbers. Commit `Tracker: curation phase 1`.
