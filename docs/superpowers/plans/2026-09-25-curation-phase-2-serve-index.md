# Curation Phase 2: Serve the Coffee Index — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The map and search read the Phase 1 index from static files (behind `EXPO_PUBLIC_COFFEE_INDEX_URL`), a monthly workflow publishes it to R2, and logging an index dot never duplicates an already-rated shop.

**Architecture:** The build writes an upload-ready folder (versioned tiles, fine tiles for dense cells, 1° search files, root manifest). The app gets one small client module (`lib/map/coffee-index.ts`) that the existing hook and search call when the switch is set. Logging dedupes in `logVisit` before the RPC.

**Tech Stack:** TypeScript, Vitest, Node `http`/`zlib`, GitHub Actions + `aws s3` CLI against R2, Next.js rewrites, Expo.

Spec: `docs/superpowers/specs/2026-09-25-curation-phase-2-serve-index-design.md`.

---

### Task 1: Build output — split cells, search files, upload layout, dev server

**Files:** `packages/coffee-index/config.json` (add `splitAbove: 1000`, `splitStep: 0.025`, `searchStep: 1`), `src/tiles.ts`, `test/tiles.test.ts`, `src/build.ts`, create `src/serve.ts`, `package.json` (script `serve`).

- [ ] Failing tests in `test/tiles.test.ts`:

```ts
import { layoutTiles, searchRows } from "../src/tiles";

describe("layoutTiles", () => {
  const cfg = { tileStep: 0.1, splitStep: 0.025, splitAbove: 2 };
  it("keeps sparse cells whole and splits dense ones into fine cells", () => {
    const places = [
      { id: "a", lat: 33.71, lng: -84.39 },
      { id: "b", lat: 10.701, lng: 106.601 }, { id: "c", lat: 10.701, lng: 106.602 }, { id: "d", lat: 10.79, lng: 106.69 },
    ];
    const { coarse, fine, split } = layoutTiles(places, cfg);
    expect([...coarse.keys()]).toEqual(["33.7_-84.4"]);
    expect(split).toEqual(["10.7_106.6"]);
    expect([...fine.keys()].sort()).toEqual(["10.7_106.6", "10.775_106.675"]);
  });
});

describe("searchRows", () => {
  it("groups compact rows by 1° cell", () => {
    const rows = searchRows([{ id: "cs_1", name: "Perc", lat: 33.78, lng: -84.35 }], 1);
    expect(rows.get("33_-85")).toEqual([["cs_1", "Perc", 33.78, -84.35]]);
  });
});
```

- [ ] Implement in `src/tiles.ts`:

```ts
export function layoutTiles<T extends { lat: number; lng: number }>(places: T[], cfg: { tileStep: number; splitStep: number; splitAbove: number }) {
  const coarse = toTiles(places, cfg.tileStep);
  const fine = new Map<string, T[]>();
  const split: string[] = [];
  for (const [key, ps] of coarse) {
    if (ps.length <= cfg.splitAbove) continue;
    coarse.delete(key);
    split.push(key);
    for (const [k, f] of toTiles(ps, cfg.splitStep)) fine.set(k, f);
  }
  return { coarse, fine, split: split.sort() };
}

export function searchRows(places: { id: string; name: string; lat: number; lng: number }[], step: number) {
  const rows = new Map<string, [string, string, number, number][]>();
  for (const p of places) {
    const k = tileKey(p.lat, p.lng, step);
    const row: [string, string, number, number] = [p.id, p.name, Math.round(p.lat * 1e5) / 1e5, Math.round(p.lng * 1e5) / 1e5];
    const list = rows.get(k);
    if (list) list.push(row);
    else rows.set(k, [row]);
  }
  return rows;
}
```

- [ ] `build.ts`: write under `<out>/<date>/v/<version>/` (`tiles/`, `tiles-fine/`, `search/`, `places.ndjson.gz`, `id_map.json`, reports, version `manifest.json` with `{ version, builtAt, configVersion, sources, bbox, count, tileStep, splitStep, searchStep, split }`) and write `<out>/<date>/manifest.json` = `{ version }`. Tile/search files are gzip bytes named `.json`. `--prev` now points at a version folder (`…/v/<version>`).
- [ ] `src/serve.ts`: Node `http` server on `PORT` (8787) serving a folder; `.json` files under `v/` get `Content-Encoding: gzip`; every response gets `Access-Control-Allow-Origin: *` and `Content-Type: application/json`. Script: `"serve": "tsx src/serve.ts"`.
- [ ] Tests pass; pilot build + `curl --compressed localhost:8787/v/<ver>/tiles/33.7_-84.4.json | head -c 200` shows JSON. Commit.

### Task 2: Monthly workflow

**Files:** create `.github/workflows/coffee-index.yml`.

- [ ] Workflow: `on: schedule: cron "0 6 25 * *"` + `workflow_dispatch`; ubuntu-latest; checkout, pnpm/action-setup, setup-node 22 with pnpm cache, `pnpm install --frozen-lockfile`; env from secrets; step "previous build": `curl -fsS $PUBLIC/manifest.json` → version → download `v/$ver/id_map.json` and `v/$ver/places.ndjson.gz` into `prev/v/$ver` (on 404 set `FIRST=--first-run`); build; `aws s3 sync out/*/v s3://$R2_BUCKET/v --endpoint-url https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com` twice (gzip `.json` under tiles/tiles-fine/search with `--content-encoding gzip --content-type application/json --cache-control "public, max-age=31536000, immutable"`, the rest plain); then `aws s3 cp` root manifest with `max-age=300`; prune: list `v/` prefixes, delete all but the newest two. `PUBLIC` is `vars.COFFEE_INDEX_PUBLIC_URL`.
- [ ] `actionlint` if available, else YAML parse check. Commit.

### Task 3: App client for the index

**Files:** `apps/app/components/map/types.ts` (NearbyShopPin gains optional `sourceIds?: string[]`, `visibility?: "show" | "dim"`), create `apps/app/lib/map/coffee-index.ts` + test.

- [ ] Tests (pure functions): `tileKeysFor(box, manifest)` returns coarse keys and swaps split keys for their fine keys inside the box; `toPin(entry)` maps a tile entry to `NearbyShopPin` (`externalId` = `id`); `searchIndexRows(rows, query)` keeps rows whose normalized name contains every query word; `searchCellsAround(origin)` → 9 keys.
- [ ] Implement with `fetchJson(url)` (plain `fetch().json()`), a module-level `Map` cache for tiles, and `loadManifest(base)` (root, then version) memoized per base URL. Commit.

### Task 4: Hook switch, dim filtering, cross-scheme duplicates, dim dot

**Files:** `apps/app/lib/map/nearby-map-data.ts`, `apps/app/lib/map/shop-list.ts` + tests, `apps/app/components/map/pin-markup.ts` + test, `apps/app/components/map/MapView.web.tsx`.

- [ ] `dropRatedDuplicates` matches rated `externalId` against `n.externalId` or any `n.sourceIds` with the `osm:` prefix stripped. Test: rated `node/1` drops index dot with `sourceIds: ["ov:x", "osm:node/1"]`.
- [ ] `visibleNearby(nearby, bounds)`: drops `visibility === "dim"` when `latSpan(bounds) >= 0.05`. Test both sides.
- [ ] Hook: `const INDEX_URL = process.env.EXPO_PUBLIC_COFFEE_INDEX_URL`; when set, `fetchIndexShops(box, INDEX_URL)` replaces `fetchNearbyOsmShops`. Apply `visibleNearby` in the `nearbyShops` memo.
- [ ] `nearbyDotHtml({ selected, dim })`: dim dots are 5 px at opacity .45. MapView passes `dim: s.visibility === "dim"`. Commit.

### Task 5: Search stage 3 from the index

**Files:** `apps/app/components/map/map-search.tsx`, `apps/app/lib/map/geocode.ts`.

- [ ] `searchNearbyShops` uses `searchIndex(query, origin, INDEX_URL)` when the switch is set, else Overpass. Result pins carry `externalId = cs_…`; name, lat, lng; the rest null (the preview card already handles nulls). Commit.

### Task 6: Logging without duplicate shops

**Files:** `packages/supabase/src/queries.ts` (+ test), `apps/app/lib/log/params.ts` (+ test), `apps/app/app/(tabs)/map.tsx` (log route params).

- [ ] `LogVisitInput` "osm" kind gains `legacyIds?: string[]`. `logVisit`: before the RPC, `select id from shops where external_id in ([externalId, ...legacyIds]) limit 1`; if found, take the existing-shop insert path. Test with the repo's existing Supabase client mock pattern in `packages/supabase/test/queries.test.ts`.
- [ ] Map passes `sourceIds` (comma-joined, only `osm:` ones, prefix stripped) as a `legacyIds` route param; `parseLogParams` reads it into the "osm" params; the log screen passes it through. Commit.

### Task 7: Site — rewrite and Data sources

**Files:** `apps/web/next.config.ts`, `apps/web/app/data-sources/page.tsx`.

- [ ] `rewrites()` returns `[{ source: "/coffee-index/:path*", destination: `${COFFEE_INDEX_ORIGIN}/:path*` }]` when `process.env.COFFEE_INDEX_ORIGIN` is set, else `[]`.
- [ ] Data sources: add Overture Maps Foundation (CDLA Permissive 2.0; includes Foursquare OS Places, Apache 2.0); when `COFFEE_INDEX_ORIGIN` is set, a "Download the coffee index (ODbL)" link to `/coffee-index/v/<version>/places.ndjson.gz` from the root manifest (fetched at build/revalidate, 1 h). Build passes. Commit.

### Task 8: End to end, compare, tracker

- [ ] Rebuild worldwide from cache into the new layout; `pnpm --filter @coffeesnob/coffee-index serve out/world/<date>`.
- [ ] Run the app with `EXPO_PUBLIC_COFFEE_INDEX_URL=http://localhost:8787`: Atlanta dots load with no `/api/nearby-shops` request (check network); zoom in shows dim dots; a Ho Chi Minh City view loads fine tiles; search "muchacho", "east pole"; rated shops show once.
- [ ] Atlanta compare: Overpass (switch off) vs index (switch on) counts in the same viewport; note obvious misses.
- [ ] Tracker Status line + R2 setup checklist for the owner. Merge.
