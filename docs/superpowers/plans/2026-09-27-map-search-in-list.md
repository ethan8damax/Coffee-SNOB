# Map Search in the List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the map's search dropdown with in-list search results (Places + Shops), make matching strict and "name + city" aware, and tie "Guide" links to real editorial guides.

**Architecture:** Server (`apps/web/app/api/search`) filters Photon hits strictly, resolves a trailing city ("muchacho atlanta"), and tags places with an editorial `guideSlug` via a new `cities.city_key`. The app moves search fetching into a `useMapSearch` hook, builds sections with a pure `buildSearchSections`, and renders them in the panel/sheet instead of an overlay.

**Tech Stack:** Expo Router / React Native Web, Next.js route handlers, Supabase (Postgres + supabase-js), Photon, vitest.

Spec: `docs/superpowers/specs/2026-09-27-map-search-in-list-design.md`.

---

### Task 1: `cities.city_key` + guide lookup + rated search by city

**Files:**
- Create: `supabase/migrations/0033_city_guide_key.sql`
- Modify: `packages/supabase/src/queries.ts` (`searchRatedShops`, replace `citiesWithVerdicts`, delete `getCityShops`)
- Modify: `packages/supabase/src/index.ts` exports
- Modify: `packages/supabase/src/types.ts` (regenerate)

- [ ] Migration:

```sql
-- Joins a searched place (Photon) to its editorial city row. Same rule as
-- cityKey() in packages/supabase/src/city.ts and shops.city_key (0026).
alter table public.cities add column city_key text unique;

update public.cities c set city_key = v.key
from (values
  ('tampa', 'tampa-florida-us'),
  ('atlanta', 'atlanta-georgia-us'),
  ('austin', 'austin-texas-us'),
  ('nashville', 'nashville-tennessee-us'),
  ('new-york', 'new-york-new-york-us'),
  ('portland', 'portland-oregon-us'),
  ('san-francisco', 'san-francisco-california-us'),
  ('seattle', 'seattle-washington-us'),
  ('london', 'london-england-gb')
) as v(slug, key)
where c.slug = v.slug;
```

- [ ] Queries:

```ts
export async function searchRatedShops(client: Client, query: string, limit = 8) {
  const q = query.trim().replace(/[%_\\,()]/g, "");
  if (q.length < 2) return [];
  // Every word must appear in the name or the city, in any order ("goats
  // dancing" finds "Dancing Goats Coffee"; "muchacho atlanta" finds Muchacho).
  let request = client
    .from("shop_ratings")
    .select("id, name, lat, lng, neighborhood, locality, is_snob_approved, tag, price_tier, rating, log_count, external_id");
  for (const word of q.split(/\s+/)) request = request.or(`name.ilike.%${word}%,locality.ilike.%${word}%`);
  const { data, error } = await request.not("rating", "is", null).order("rating", { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}

// Searched cities with a published editorial guide → that guide's city slug.
export async function citiesWithGuides(client: Client, keys: string[]): Promise<Map<string, string>> {
  if (keys.length === 0) return new Map();
  const { data, error } = await client
    .from("cities")
    .select("slug, city_key, lists!inner(id)")
    .in("city_key", keys)
    .in("status", ["live", "demo"])
    .eq("lists.type", "city_guide");
  if (error) throw error;
  return new Map(data.flatMap((c) => (c.city_key ? [[c.city_key, c.slug] as const] : [])));
}
```

- [ ] Apply migration (Supabase MCP `apply_migration`), regenerate `types.ts`, `npx tsc --noEmit` in `packages/supabase`, commit.

### Task 2: Strict matching + place tails in `apps/web/lib/photon.ts`

- [ ] Failing tests in `apps/web/lib/photon.test.ts`:

```ts
describe("matchesQuery", () => {
  it("needs every word to start a word in some field", () => {
    expect(matchesQuery("muchacho atlanta", ["Muchacho", "Atlanta", "Georgia"])).toBe(true);
    expect(matchesQuery("george how", ["George Howell Coffee", "Boston"])).toBe(true);
    expect(matchesQuery("wuz here", ["武安市", undefined, "河北省"])).toBe(false);
    expect(matchesQuery("wuz here", ["Herbertingen", undefined, "Baden-Württemberg"])).toBe(false);
    expect(matchesQuery("cafe", ["Café Kitsuné"])).toBe(true);
  });
});

describe("placeTails", () => {
  it("splits the last one or two words off as a place, longest first", () => {
    expect(placeTails("joe coffee new york")).toEqual([{ name: "joe coffee", place: "new york" }, { name: "joe coffee new", place: "york" }]);
    expect(placeTails("muchacho atlanta")).toEqual([{ name: "muchacho", place: "atlanta" }]);
    expect(placeTails("muchacho")).toEqual([]);
  });
});
```

- [ ] Implement:

```ts
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Every query word has to start a word in one of the fields (name, city,
// state). Photon is typo-tolerant; this drops its guesses ("wuz here" → Wu'an).
export function matchesQuery(query: string, fields: (string | null | undefined)[]): boolean {
  const hay = ` ${fold(fields.filter(Boolean).join(" "))}`;
  const words = fold(query).split(" ").filter(Boolean);
  return words.length > 0 && words.every((w) => hay.includes(` ${w}`));
}

// "muchacho atlanta" → try "atlanta" as the place and "muchacho" as the name.
// Two-word places first so "new york" wins over "york".
export function placeTails(query: string): { name: string; place: string }[] {
  const words = query.trim().split(/\s+/);
  const tails = [2, 1].filter((n) => words.length > n);
  return tails.map((n) => ({ name: words.slice(0, -n).join(" "), place: words.slice(-n).join(" ") }));
}
```

- [ ] `Place` gains `guideSlug: string | null` (route fills it; `cityKey` stays internal). Update existing tests for the new field. Run `npm test` in `apps/web`, commit.

### Task 3: `/api/search` route

- [ ] Filter features with `matchesQuery(q, [name, city, state])` before `toSearchHit`.
- [ ] `findScope(q, bias)`: for each `placeTails(q)` entry, one Photon call (`osm_tag=place`, limit 5); first city-level hit whose `[name, state]` matches the place words wins → `{ name, place: { primary, secondary, lat, lng } }`. Failures → `null` (never fail the search).
- [ ] `guideSlug` from `citiesWithGuides`; response places omit `cityKey`.
- [ ] Response: `{ places, shops, scoped }`. Commit.

### Task 4: App search client + sections

- [ ] `apps/app/lib/map/geocode.ts`: `Place.guideSlug?: string | null`; `searchEverywhere` returns `scoped`; delete `searchNearbyShops` + its test.
- [ ] `apps/app/lib/map/search-sort.ts`: `buildSearchSections(results, filter)` → `{ places (≤3), shops }` with filter; `toListRow(result, origin)`. Tests: cap, filter hides unrated + low verdicts, places survive filters.
- [ ] `apps/app/lib/map/use-map-search.ts`: the fetch effect from `map-search.tsx`, plus the scoped index search. Commit.

### Task 5: UI

- [ ] `MapSearch` → controlled input only (value, onChangeText, onFocus, onClear).
- [ ] New `components/map/search-results.tsx`: Places section (row + Guide button → `${webAppUrl}/city-guides/${slug}`), Shops section (`ShopRow`), pending/empty/add-missing.
- [ ] `map.tsx`: owns `query`; panel/sheet shows results while searching; place pick clears query + remembers guide for the "Read the <city> guide →" header; mobile focus → List, shop pick → Map.
- [ ] `MapTopBar` passes the new props through. Commit.

### Task 6: Remove the ratings city page

- [ ] Delete `apps/app/app/(tabs)/city/[slug].tsx`, `apps/app/lib/city/use-city.ts`, `/city/` nav/public prefixes + their tests. Commit.

### Task 7: Verify + ship

- [ ] `npm test` + `tsc` in app, web, packages/supabase.
- [ ] Browser check on desktop + phone widths: "wuz here", "george howell boston", "muchacho atlanta", "tampa".
- [ ] Tracker status line; push main.
