# Map Phase 1 — Launch Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix what every map user hits on launch day: duplicate pins, slow/uncached area loads, zoomed-out timeouts, Nominatim bursts, non-coffee dots, a wrong count, a 5s spinner, a mismatched fallback city, and two DB performance flags.

**Architecture:** Mostly small, pure-function changes in `apps/app/lib/map/*` and `apps/web/lib/nearby-shops.ts` (each unit tested), wired into the existing map screen and `/api/nearby-shops` route. One migration (0025) exposes `external_id` on `shop_ratings`, indexes `logs(user_id)`, and rewrites 10 RLS expressions via `alter policy`.

**Tech Stack:** Expo Router (react-native-web) app, Next.js 15 route handlers, Supabase Postgres, vitest. Spec: `docs/superpowers/specs/2026-09-23-map-browse-and-search-design.md` (Phase 1).

**Test commands:** `cd apps/app && npx vitest run <file>` · `cd apps/web && npx vitest run <file>` · typecheck with `npx tsc --noEmit -p .` in `apps/app`, `apps/web`, `packages/supabase`.

---

## File map

| File | Change |
|---|---|
| `supabase/migrations/0025_map_phase1_db.sql` | Create: view column, index, policies |
| `packages/supabase/src/types.ts` | `shop_ratings` Row gains `external_id` |
| `packages/supabase/src/queries.ts` | rated-shop selects include `external_id` |
| `apps/app/components/map/types.ts` | `RatedShopPin.externalId` |
| `apps/app/lib/map/nearby-map-data.ts` | map `externalId`; snap + zoom limit + dedupe in the hook; `"zoomed-out"` status |
| `apps/app/lib/map/bounds.ts` (+test) | `snapToGrid`, `latSpan` |
| `apps/app/lib/map/shop-list.ts` (+test) | `dropRatedDuplicates` |
| `apps/app/lib/map/fallback.ts` | Create: shared fallback city + last-known location |
| `apps/app/components/map/shop-list-view.tsx` | zoomed-out state |
| `apps/app/components/map/map-search.tsx` | no reverse geocoding |
| `apps/app/lib/map/geocode.ts` (+test) | delete `reverseGeocode` |
| `apps/app/app/(tabs)/map.tsx` | honest count, draw immediately, shared fallback |
| `apps/app/app/(tabs)/index.tsx` | shared fallback |
| `apps/web/lib/nearby-shops.ts` (+test) | `isCoffeePlace`, city in address |
| `apps/web/app/api/nearby-shops/route.ts` | coffee filter, CDN cache headers |

---

### Task 1: Migration 0025 — view column, index, policies

**Files:**
- Create: `supabase/migrations/0025_map_phase1_db.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Map Phase 1 (docs/superpowers/specs/2026-09-23-map-browse-and-search-design.md).

-- 1. Expose external_id so the app can drop the OSM dot that duplicates a
--    rated pin. Appended last: create or replace view may only add columns
--    at the end. Body otherwise identical to 0022.
create or replace view public.shop_ratings with (security_invoker = true) as
  select s.id,
    s.name,
    s.lat,
    s.lng,
    s.city_id,
    s.neighborhood,
    sc.shop_id is not null as is_snob_approved,
    sc.tag,
    sc.price_tier,
    coalesce(sc.editorial_rating, round(avg(l.rating))::smallint) as rating,
    count(l.id) as log_count,
    s.external_id
  from shops s
    left join shop_curations sc on sc.shop_id = s.id
    left join logs l on l.shop_id = s.id
  where not public.is_chain_name(s.name)
  group by s.id, sc.shop_id, sc.tag, sc.price_tier, sc.editorial_rating
  having sc.shop_id is not null or count(l.id) > 0;

-- 2. Profiles and the feed look logs up by user.
create index if not exists logs_user_id_idx on public.logs (user_id);

-- 3. Same rules, but auth.uid() evaluated once per query instead of per row
--    (Supabase advisor auth_rls_initplan). alter policy keeps names/roles/cmds.
alter policy "admins insert admin_actions" on public.admin_actions
  with check (public.is_admin() and actor_id = (select auth.uid()));
alter policy "users manage their own comment likes" on public.comment_likes
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "users manage their own comments" on public.comments
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "users manage their own follows" on public.follows
  using ((select auth.uid()) = follower_id) with check ((select auth.uid()) = follower_id);
alter policy "users manage their own saves" on public.list_saves
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "users manage their own log likes" on public.log_likes
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "users manage their own logs" on public.logs
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "users insert their own profile" on public.profiles
  with check ((select auth.uid()) = id);
alter policy "users update their own profile" on public.profiles
  using ((select auth.uid()) = id);
alter policy "users manage their own shop saves" on public.shop_saves
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
```

- [ ] **Step 2: Apply to production** with the Supabase `apply_migration` tool (project `kyiuhuivyugoqljqodil`, name `map_phase1_db`, the SQL above).

- [ ] **Step 3: Verify**

Run via `execute_sql`:
```sql
select (select string_agg(name||':'||coalesce(external_id,'-'), ' | ') from public.shop_ratings) rated,
  (select array_to_string(reloptions, ',') from pg_class where oid = 'public.shop_ratings'::regclass) opts,
  (select count(*) from pg_indexes where indexname = 'logs_user_id_idx') idx;
```
Expected: 3 rated shops each with a `way/…` id; `security_invoker=true`; `idx = 1`. Then run `get_advisors` (performance): no `auth_rls_initplan` findings and no `logs_user_id_fkey` finding. Run `get_advisors` (security): only the two pre-existing warnings.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0025_map_phase1_db.sql
git commit -m "Map phase 1 DB: shop_ratings.external_id, logs(user_id) index, RLS initplan"
```

---

### Task 2: Carry `externalId` on rated pins

**Files:**
- Modify: `packages/supabase/src/types.ts` (the `shop_ratings` Row)
- Modify: `packages/supabase/src/queries.ts` (`getRatedShopsInBounds`, `searchRatedShops`)
- Modify: `apps/app/components/map/types.ts`, `apps/app/lib/map/nearby-map-data.ts`
- Test: `apps/app/lib/map/nearby-map-data.test.ts`

- [ ] **Step 1: Write the failing test** (append to `nearby-map-data.test.ts`; add `toRatedShopPin` to its import)

```ts
describe("toRatedShopPin", () => {
  it("carries the OSM external id so the duplicate dot can be dropped", () => {
    const pin = toRatedShopPin({
      id: "s1", name: "Muchacho", lat: 33.75, lng: -84.36, neighborhood: null, is_snob_approved: false,
      tag: null, price_tier: null, rating: 5, log_count: 1, external_id: "way/271015925",
    });
    expect(pin.externalId).toBe("way/271015925");
  });
});
```

- [ ] **Step 2: Run it** — `cd apps/app && npx vitest run lib/map/nearby-map-data.test.ts` → FAIL (`external_id` not in type / `externalId` undefined).

- [ ] **Step 3: Implement**

`packages/supabase/src/types.ts`, in `shop_ratings: { Row: {`, after `log_count: number` add:
```ts
          external_id: string | null
```
`packages/supabase/src/queries.ts`: in both `getRatedShopsInBounds` and `searchRatedShops`, change the select string to
```ts
    .select("id, name, lat, lng, neighborhood, is_snob_approved, tag, price_tier, rating, log_count, external_id")
```
`apps/app/components/map/types.ts`, in `RatedShopPin` after `logCount: number;`:
```ts
  // The OSM id this shop was logged from (null for admin-created shops) —
  // lets the map drop the matching unrated dot.
  externalId: string | null;
```
`apps/app/lib/map/nearby-map-data.ts`: add `external_id: string | null;` to `RatedShopRow`, and `externalId: row.external_id,` to the object `toRatedShopPin` returns.

- [ ] **Step 4: Run tests + typecheck** — `npx vitest run lib/map/nearby-map-data.test.ts` → PASS; `npx tsc --noEmit -p .` in `apps/app` and `packages/supabase` → clean. (Fix any test fixture building a `RatedShopPin` by adding `externalId: null`.)

- [ ] **Step 5: Commit** — `git add -A packages/supabase apps/app && git commit -m "Carry OSM external id on rated pins"`

---

### Task 3: Drop the OSM dot that duplicates a rated pin

**Files:**
- Modify: `apps/app/lib/map/shop-list.ts`, `apps/app/lib/map/nearby-map-data.ts`
- Test: `apps/app/lib/map/shop-list.test.ts`

- [ ] **Step 1: Write the failing test** (append; import `dropRatedDuplicates`; reuse the file's `nearby()` helper)

```ts
describe("dropRatedDuplicates", () => {
  it("drops unrated dots that are already rated pins", () => {
    const rated = [{ externalId: "way/1" }, { externalId: null }];
    const dots = [nearby("way/1", 0, 0), nearby("node/2", 0, 0)];
    expect(dropRatedDuplicates(dots, rated).map((d) => d.externalId)).toEqual(["node/2"]);
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run lib/map/shop-list.test.ts` → FAIL (not exported).

- [ ] **Step 3: Implement** in `shop-list.ts`:

```ts
// A rated shop logged from OSM is also in the live OSM layer; show it once, as the rated pin.
export function dropRatedDuplicates(nearby: NearbyShopPin[], rated: { externalId: string | null }[]): NearbyShopPin[] {
  const ratedIds = new Set(rated.map((r) => r.externalId).filter(Boolean));
  return nearby.filter((n) => !ratedIds.has(n.externalId));
}
```
In `nearby-map-data.ts`, import it and change the `nearbyShops` memo to:
```ts
  const nearbyShops = useMemo(
    () => (bounds ? dropRatedDuplicates(fetchedNearby, fetchedRated).filter((s) => withinBounds(bounds, s.lat, s.lng)) : []),
    [fetchedNearby, fetchedRated, bounds]
  );
```

- [ ] **Step 4: Run** → PASS; typecheck `apps/app` clean.

- [ ] **Step 5: Commit** — `git commit -am "Show each rated shop once on the map"`

---

### Task 4: Grid-snapped fetch box + zoom limit

**Files:**
- Modify: `apps/app/lib/map/bounds.ts`, `apps/app/lib/map/nearby-map-data.ts`, `apps/app/components/map/shop-list-view.tsx`
- Test: `apps/app/lib/map/bounds.test.ts`

- [ ] **Step 1: Write the failing tests** (append to `bounds.test.ts`; import `snapToGrid`, `latSpan`)

```ts
describe("snapToGrid", () => {
  it("grows a box outward to the grid so nearby views request the same box", () => {
    expect(snapToGrid({ minLat: 33.74, minLng: -84.41, maxLat: 33.78, maxLng: -84.37 }, 0.1))
      .toEqual({ minLat: 33.7, minLng: -84.5, maxLat: 33.8, maxLng: -84.3 });
    expect(snapToGrid({ minLat: 33.71, minLng: -84.49, maxLat: 33.79, maxLng: -84.31 }, 0.1))
      .toEqual({ minLat: 33.7, minLng: -84.5, maxLat: 33.8, maxLng: -84.3 });
  });
});

describe("latSpan", () => {
  it("is the box's height in degrees", () => {
    expect(latSpan({ minLat: 33.7, minLng: 0, maxLat: 33.9, maxLng: 1 })).toBeCloseTo(0.2);
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run lib/map/bounds.test.ts` → FAIL.

- [ ] **Step 3: Implement** in `bounds.ts`:

```ts
// Grows a box outward to a fixed grid (step in degrees). Viewers looking at
// roughly the same area then request byte-identical URLs, which the CDN caches
// for everyone (see /api/nearby-shops Cache-Control).
export function snapToGrid(b: MapBounds, step: number): MapBounds {
  const down = (n: number) => round(Math.floor(round(n / step)) * step);
  const up = (n: number) => round(Math.ceil(round(n / step)) * step);
  return { minLat: down(b.minLat), minLng: down(b.minLng), maxLat: up(b.maxLat), maxLng: up(b.maxLng) };
}

export function latSpan(b: MapBounds): number {
  return b.maxLat - b.minLat;
}
```

In `nearby-map-data.ts`:
- Change `export type NearbyStatus = "loading" | "ready" | "error";` to `"loading" | "ready" | "error" | "zoomed-out"`.
- Add constants under `FETCH_PADDING`:
```ts
// Fetch boxes snap outward to this grid (~11 km) so the CDN can share them.
const GRID_STEP = 0.1;
// Past roughly a metro area on screen, the OSM request is huge and times out —
// show rated pins only and ask for a zoom-in instead.
const MAX_NEARBY_VIEW_SPAN = 0.2;
```
- Update imports: `import { containsBounds, latSpan, padBounds, snapToGrid, withinBounds } from "./bounds";`
- Replace the whole `useEffect(() => { if (!bounds) return; … }, [bounds, webAppUrl, reloadKey]);` with:
```ts
  useEffect(() => {
    if (!bounds) return;
    if (fetchedRef.current && containsBounds(fetchedRef.current, bounds)) return;
    const zoomedOut = latSpan(bounds) > MAX_NEARBY_VIEW_SPAN;
    if (!zoomedOut) setStatus("loading");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      const box = snapToGrid(padBounds(bounds, FETCH_PADDING), GRID_STEP);
      const { supabase } = require("../supabase");
      getRatedShopsInBounds(supabase, box)
        .then((rows) => {
          // A Snob-Approved shop with no editorial_rating set yet and no
          // community logs has rating = null in the view — can't render
          // as a tiered pin, so drop it rather than show a broken value.
          if (requestIdRef.current === requestId) setFetchedRated(rows.filter((r) => r.rating != null).map(toRatedShopPin));
        })
        .catch(() => {
          if (requestIdRef.current === requestId) setFetchedRated([]);
        });
      if (zoomedOut) {
        // fetchedRef stays unset so zooming back in fetches the OSM layer.
        setFetchedNearby([]);
        setStatus("zoomed-out");
        return;
      }
      fetchNearbyOsmShops(box, webAppUrl)
        .then((shops) => {
          if (requestIdRef.current !== requestId) return;
          fetchedRef.current = box;
          setFetchedNearby(shops);
          setStatus("ready");
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) return;
          setFetchedNearby([]);
          setStatus("error");
        });
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [bounds, webAppUrl, reloadKey]);
```

In `shop-list-view.tsx`, `EmptyState`: before the final `return`, add
```tsx
  if (status === "zoomed-out") {
    return (
      <View style={{ padding: 28 }}>
        <Body style={{ color: colors.ink2, textAlign: "center" }}>Zoom in to see every café. Rated shops show at any zoom.</Body>
      </View>
    );
  }
```
and in the `notices` block add `if (status === "zoomed-out" && rows.length > 0) notices.push("Zoom in to see every café, not just rated ones.");`

- [ ] **Step 4: Run** → bounds tests PASS; `npx tsc --noEmit -p .` in `apps/app` clean.

- [ ] **Step 5: Commit** — `git commit -am "Snap map fetches to a grid; rated-only when zoomed out"`

---

### Task 5: CDN cache headers + coffee-only filter on `/api/nearby-shops`

**Files:**
- Modify: `apps/web/lib/nearby-shops.ts`, `apps/web/app/api/nearby-shops/route.ts`
- Test: `apps/web/lib/nearby-shops.test.ts`

- [ ] **Step 1: Write the failing tests** (append; import `isCoffeePlace`)

```ts
describe("isCoffeePlace", () => {
  it("keeps cafés and coffee-serving restaurants", () => {
    expect(isCoffeePlace({ name: "Spiller Park Coffee", amenity: "cafe" })).toBe(true);
    expect(isCoffeePlace({ name: "Muchacho", amenity: "restaurant", cuisine: "mexican;coffee_shop" })).toBe(true);
    expect(isCoffeePlace({ name: "Tea Bar", amenity: "cafe", cuisine: "tea;coffee_shop" })).toBe(true);
  });

  it("drops bubble tea, tea-only cafés, and cafeterias", () => {
    expect(isCoffeePlace({ name: "Kung Fu Tea", amenity: "cafe", cuisine: "bubble_tea" })).toBe(false);
    expect(isCoffeePlace({ name: "Queen Tea", amenity: "cafe", cuisine: "tea" })).toBe(false);
    expect(isCoffeePlace({ name: "Piedmont North Dining Hall", amenity: "cafe" })).toBe(false);
    expect(isCoffeePlace({ name: "One Georgia Center Cafeteria", amenity: "cafe" })).toBe(false);
  });
});
```
Also change the existing `toNearbyShop` test's tags to include `"addr:city": "Lisboa"` and its expected `address` to `"12 Rua do Ouro, Lisboa"`.

- [ ] **Step 2: Run** — `cd apps/web && npx vitest run lib/nearby-shops.test.ts` → FAIL.

- [ ] **Step 3: Implement** in `nearby-shops.ts`:

```ts
// OSM files bubble tea shops, tea rooms and institutional cafeterias under
// amenity=cafe too. Keep anything tagged coffee_shop; drop tea-only cuisines
// and cafeteria-style names. Named case list (not a classifier): extend the
// regex / cuisine set as new noise shows up in real areas.
const NON_COFFEE_CUISINES = new Set(["bubble_tea", "tea"]);
const NON_COFFEE_NAME = /\b(cafeteria|dining hall|food court)\b/i;

export function isCoffeePlace(tags: Record<string, string>): boolean {
  const cuisines = (tags.cuisine ?? "").split(";").map((c) => c.trim().toLowerCase()).filter(Boolean);
  if (cuisines.includes("coffee_shop")) return true;
  if (cuisines.length > 0 && cuisines.every((c) => NON_COFFEE_CUISINES.has(c))) return false;
  return !NON_COFFEE_NAME.test(tags.name ?? "");
}
```
And in `toNearbyShop`, replace the address lines with:
```ts
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const address = [street, tags["addr:city"]].filter(Boolean).join(", ");
```
and return `address: address || null,`.

In `route.ts`:
- Import `isCoffeePlace`.
- Change the filter chain to `.filter((el) => isCoffeePlace(el.tags ?? {}) && !isChain(el.tags ?? {}, chains))`.
- Add below `CORS_HEADERS`:
```ts
// Grid-snapped boxes (see apps/app/lib/map/bounds.ts snapToGrid) repeat across
// viewers, so let Vercel's CDN serve them for 10 minutes and stale for a day
// while it refreshes. Errors are never cached.
const CACHE_HEADERS = { ...CORS_HEADERS, "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400" };
```
- Use `CACHE_HEADERS` in the two success returns (the cached-hit `return NextResponse.json(cached.body, …)` and the final `return NextResponse.json(body, …)`). Leave the 400 and 502 returns on `CORS_HEADERS`.

- [ ] **Step 4: Run** → PASS; `npx tsc --noEmit -p .` and `npx eslint lib app/api` in `apps/web` clean.

- [ ] **Step 5: Live check** (dev server on :3107):
```bash
curl -sI "http://localhost:3107/api/nearby-shops?minLat=33.7&minLng=-84.5&maxLat=33.8&maxLng=-84.3" | grep -i cache-control
curl -s "http://localhost:3107/api/nearby-shops?minLat=33.7&minLng=-84.5&maxLat=33.8&maxLng=-84.3" | python3 -c "import json,sys;n=[s['name'] for s in json.load(sys.stdin)['shops']];print(len(n),[x for x in n if any(k in x for k in ['Tea','Dining','Cafeteria'])])"
```
Expected: `cache-control: public, s-maxage=600, stale-while-revalidate=86400`; list of tea/dining/cafeteria names is empty (a name like "Land Of A Thousand Hills Coffee & Bar" is fine).

- [ ] **Step 6: Commit** — `git commit -am "Nearby shops: CDN-cacheable, coffee only, city in address"`

---

### Task 6: Search without reverse-geocode bursts

**Files:**
- Modify: `apps/app/components/map/map-search.tsx`, `apps/app/lib/map/geocode.ts`
- Test: `apps/app/lib/map/geocode.test.ts`

- [ ] **Step 1: Delete the `reverseGeocode` tests** — remove the whole `describe("reverseGeocode", …)` block and `reverseGeocode` from the import in `geocode.test.ts`.

- [ ] **Step 2: Delete `reverseGeocode`** (and its comment) from `geocode.ts`.

- [ ] **Step 3: Rewrite the result assembly in `map-search.tsx`.** Replace the `.then(async ([places, shopRows, nearby]) => { … });` body with:
```ts
      ]).then(([places, shopRows, nearby]) => {
        if (cancelled) return;
        const shops = shopRows.map(toRatedShopPin);
        // No per-result reverse geocoding (it burst Nominatim's 1 req/s policy);
        // the secondary line comes from data we already have. Phase 2's Photon
        // search brings back a proper "City, ST" line.
        const combined: SearchResult[] = [
          ...places.map((place): SearchResult => ({ kind: "place", place })),
          ...shops.map((shop): SearchResult => ({ kind: "shop", shop, secondary: shop.neighborhood })),
          ...nearby.map((shop): SearchResult => ({ kind: "nearby", shop, secondary: shop.address })),
        ];
        setResults(sortByDistance(combined, origin));
      });
```
and drop `reverseGeocode` from the `../../lib/map/geocode` import.

- [ ] **Step 4: Run** — `cd apps/app && npx vitest run lib/map && npx tsc --noEmit -p .` → PASS / clean. `grep -rn reverseGeocode apps/app` → no hits outside node_modules.

- [ ] **Step 5: Commit** — `git commit -am "Search: drop per-result reverse geocoding"`

---

### Task 7: Shared fallback city + last-known location

**Files:**
- Create: `apps/app/lib/map/fallback.ts`
- Test: `apps/app/lib/map/fallback.test.ts`
- Modify: `apps/app/app/(tabs)/index.tsx`

- [ ] **Step 1: Write the failing test** `apps/app/lib/map/fallback.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { readLastLocation, saveLastLocation } from "./fallback";

afterEach(() => vi.unstubAllGlobals());

describe("last known location", () => {
  it("round-trips through localStorage", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    saveLastLocation({ lat: 33.75, lng: -84.36 });
    expect(readLastLocation()).toEqual({ lat: 33.75, lng: -84.36 });
  });

  it("returns null when storage is missing, throws, or holds junk", () => {
    expect(readLastLocation()).toBeNull();
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    expect(readLastLocation()).toBeNull();
    expect(() => saveLastLocation({ lat: 1, lng: 2 })).not.toThrow();
    vi.stubGlobal("localStorage", { getItem: () => "{nope", setItem: () => {} });
    expect(readLastLocation()).toBeNull();
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run lib/map/fallback.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** `apps/app/lib/map/fallback.ts`:

```ts
type Point = { lat: number; lng: number };

// Where the map and the Home feed open when the visitor's real location
// isn't available (denied, unavailable, or not yet answered).
export const FALLBACK_CITY = { name: "Atlanta", lat: 33.749, lng: -84.388 };

// Per-viewer convenience only (web): open where they last were instead of the
// fallback. Storage can be missing (native), blocked, or cleared — every path
// degrades to null / no-op.
const KEY = "snob:last-location";

export function readLastLocation(): Point | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return typeof p?.lat === "number" && typeof p?.lng === "number" ? { lat: p.lat, lng: p.lng } : null;
  } catch {
    return null;
  }
}

export function saveLastLocation(p: Point): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ lat: p.lat, lng: p.lng }));
  } catch {
    // storage blocked — nothing to do
  }
}
```

- [ ] **Step 4: Home feed uses it.** In `apps/app/app/(tabs)/index.tsx`: delete the `LISBON_FALLBACK` constant and its comment, add `import { FALLBACK_CITY } from "../../lib/map/fallback";`, and change `const center = userCenter ?? LISBON_FALLBACK;` to `const center = userCenter ?? FALLBACK_CITY;`.

- [ ] **Step 5: Run** → fallback tests PASS; `npx tsc --noEmit -p .` clean.

- [ ] **Step 6: Commit** — `git add -A apps/app && git commit -m "Shared Atlanta fallback; remember last map location"`

---

### Task 8: Map screen — draw immediately, honest count

**Files:**
- Modify: `apps/app/app/(tabs)/map.tsx`

- [ ] **Step 1: Shared fallback + last location.** Delete the local `FALLBACK` constant and its comment; import `{ FALLBACK_CITY, readLastLocation, saveLastLocation }` from `"../../lib/map/fallback"`. Replace `const center = userCenter ?? FALLBACK;` with:
```ts
  // Open right away on the real fix, else where they last were, else the
  // fallback city — never a spinner while the location prompt is pending.
  const [startCenter] = useState(() => {
    const last = readLastLocation();
    return last ? { ...last, name: "where you last were" } : FALLBACK_CITY;
  });
  const center = userCenter ?? startCenter;
```
Replace `fallbackLabel={userCenter ? null : FALLBACK.name}` with `fallbackLabel={userCenter || locationLoading ? null : startCenter.name}` (reads "Location is off, so this is Atlanta." or "…so this is where you last were.").

- [ ] **Step 2: Remove the blocking spinner.** Delete the `if (locationLoading) { return ( … ActivityIndicator … ); }` block. Change the bounds-seeding effect to seed immediately:
```ts
  useEffect(() => {
    if (!bounds) setBounds(boundsAround(center, 0.04));
  }, [bounds, center]);
```
Replace the two "opened on fallback" effects with one that flies to the real fix whenever it first arrives and remembers it:
```ts
  // The map opened before the fix (last location or fallback); move once it arrives.
  const flewToFix = useRef(false);
  useEffect(() => {
    if (!userCenter || flewToFix.current) return;
    flewToFix.current = true;
    saveLastLocation(userCenter);
    flyTo(userCenter.lat, userCenter.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCenter]);
```
Remove `ActivityIndicator` from the react-native import if now unused.

- [ ] **Step 3: Honest count.** After `const rows = useMemo(...)`, add:
```ts
  // The list stops at MAX_ROWS; the count is everything the filter shows.
  const total = visible.rated.length + visible.nearby.length;
```
Change `countLabel` to use `total` (`${total} ${total === 1 ? "shop" : "shops"} nearby`) and pass `count={total}` to both `MapSearch` and `MapTopBar` (was `rows.length`).

- [ ] **Step 4: Typecheck + tests** — `cd apps/app && npx tsc --noEmit -p . && npx vitest run` → clean / all pass. `npx eslint "app/(tabs)/map.tsx"` if the app has eslint configured (skip if not).

- [ ] **Step 5: Browser check** — run the app's web build locally (`cd apps/app && npx expo start --web`), open `/map` with location denied: map draws immediately on Atlanta (or the last location), no spinner; the count matches the pins; a rated shop (Muchacho, Atlanta) shows one pin, no "Not yet rated" twin; zooming out to a whole state shows the "Zoom in to see every café" state with rated pins still visible.

- [ ] **Step 6: Commit** — `git commit -am "Map draws immediately; count shows the real total"`

---

### Task 9: Ship

- [ ] **Step 1:** Full check — `apps/web`: `npx tsc --noEmit -p . && npx vitest run && npx next build` (stop the dev server first); `apps/app`: `npx tsc --noEmit -p . && npx vitest run`; `packages/supabase`: `npx tsc --noEmit -p . && npx vitest run`. All green.
- [ ] **Step 2:** Add a dated Status log line to `docs/v1-launch-tracker.md` summarizing Phase 1 and what was verified live.
- [ ] **Step 3:** `git push origin main`. After Vercel deploys, re-run the Task 5 Step 5 `curl -sI` against the production web URL twice and confirm the second response has `x-vercel-cache: HIT`.
