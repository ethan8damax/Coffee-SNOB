# Map Phase 3 — City Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every rated shop appears on its city's page (`/city/atlanta-georgia-us`) from its first rating, and search links straight to it.

**Architecture:** Shops store `locality`/`region`/`country_code`, captured when first logged from a Photon reverse lookup (`/api/locate`), plus a generated `city_key` slug. `shop_ratings` exposes them, so a city page is one query (`city_key = slug`, best verdict first). One slug rule is shared by SQL (generated column) and TypeScript (`cityKey()`), so a Photon place result ("Atlanta", "Georgia", "US") links to the same page its shops land on.

**Tech Stack:** Supabase Postgres, Next.js route handler, Expo Router, vitest. Spec: `docs/superpowers/specs/2026-09-23-map-browse-and-search-design.md` (Phase 3).

**Cut from the spec (on purpose):** the bounds-first RPC for rated pins. At 3 rated shops it's premature and would duplicate `shop_ratings` (incl. the chain filter) in a second place. Revisit when `shop_ratings` shows up slow.

**Slug rule (both sides):** `null` if no locality; else `"<locality>-<region>-<country_code>"`, every run of non-`[A-Za-z0-9]` → `-`, lowercased, leading/trailing `-` trimmed. "Atlanta, Georgia, US" → `atlanta-georgia-us`.

**Locality rule:** Photon reverse `city`, else `county` (unincorporated areas have no city). Region = full state name as Photon gives it. Country = ISO code, uppercased.

---

### Task 1: Migration 0026 — shop location, city key, logging, view, backfill (controller)

**Files:** Create `supabase/migrations/0026_shop_city.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Map Phase 3: shops know their city, so city pages can list every rated shop.

alter table public.shops
  add column locality text,
  add column region text,
  add column country_code text,
  -- Same rule as cityKey() in packages/supabase/src/city.ts — keep in step.
  add column city_key text generated always as (
    case when locality is null then null
    else btrim(lower(regexp_replace(locality || '-' || coalesce(region, '') || '-' || coalesce(country_code, ''), '[^A-Za-z0-9]+', '-', 'g')), '-')
    end
  ) stored;

create index shops_city_key_idx on public.shops (city_key);

-- log_shop_visit gains the shop's city (from the app's /api/locate lookup).
-- Signature changes, so drop + recreate and restore the grants (0015 pattern).
drop function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date, text, text, text, text, text);

create function public.log_shop_visit(
  p_external_id text,
  p_name text,
  p_lat double precision,
  p_lng double precision,
  p_rating smallint,
  p_note text default null,
  p_visited_at date default current_date,
  p_drink text default null,
  p_address text default null,
  p_website text default null,
  p_phone text default null,
  p_hours text default null,
  p_locality text default null,
  p_region text default null,
  p_country_code text default null
)
returns table(shop_id uuid, log_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_shop_id uuid;
  v_log_id uuid;
  v_website text := nullif(btrim(p_website), '');
begin
  if auth.uid() is null then
    raise exception 'must be authenticated to log a visit';
  end if;

  if not public.is_active() then
    raise exception 'account is suspended';
  end if;

  if public.is_chain_name(p_name) then
    raise exception 'chain shops can''t be logged';
  end if;

  if v_website is not null and v_website !~* '^https?://' then
    v_website := null;
  end if;

  insert into public.shops (external_id, name, lat, lng, address, website, phone, hours, locality, region, country_code)
  values (
    p_external_id,
    p_name,
    p_lat,
    p_lng,
    left(nullif(btrim(p_address), ''), 300),
    left(v_website, 500),
    left(nullif(btrim(p_phone), ''), 50),
    left(nullif(btrim(p_hours), ''), 500),
    left(nullif(btrim(p_locality), ''), 100),
    left(nullif(btrim(p_region), ''), 100),
    upper(left(nullif(btrim(p_country_code), ''), 2))
  )
  on conflict (external_id) where external_id is not null do update set
    address      = coalesce(shops.address,      excluded.address),
    website      = coalesce(shops.website,      excluded.website),
    phone        = coalesce(shops.phone,        excluded.phone),
    hours        = coalesce(shops.hours,        excluded.hours),
    locality     = coalesce(shops.locality,     excluded.locality),
    region       = coalesce(shops.region,       excluded.region),
    country_code = coalesce(shops.country_code, excluded.country_code)
  returning id into v_shop_id;

  insert into public.logs (user_id, shop_id, rating, note, drink, visited_at)
  values (
    auth.uid(),
    v_shop_id,
    p_rating,
    left(p_note, 500),
    left(nullif(btrim(p_drink), ''), 40),
    coalesce(p_visited_at, current_date)
  )
  returning id into v_log_id;

  return query select v_shop_id, v_log_id;
end;
$function$;

revoke all on function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date, text, text, text, text, text, text, text, text) from public;
revoke all on function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date, text, text, text, text, text, text, text, text) from anon, authenticated;
grant execute on function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date, text, text, text, text, text, text, text, text) to authenticated;

-- shop_ratings exposes the city (appended; body otherwise as 0025).
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
    s.external_id,
    s.locality,
    s.region,
    s.country_code,
    s.city_key
  from shops s
    left join shop_curations sc on sc.shop_id = s.id
    left join logs l on l.shop_id = s.id
  where not public.is_chain_name(s.name)
  group by s.id, sc.shop_id, sc.tag, sc.price_tier, sc.editorial_rating
  having sc.shop_id is not null or count(l.id) > 0;

-- Backfill the shops logged before this (Photon reverse lookup, 2026-09-24).
update public.shops s set locality = v.locality, region = v.region, country_code = v.cc
from (values
  ('way/271015925', 'Atlanta',  'Georgia', 'US'),
  ('way/992871109', 'Kennesaw', 'Georgia', 'US'),
  ('way/365590030', 'Roswell',  'Georgia', 'US'),
  ('way/298170920', 'Cobb',     'Georgia', 'US')
) as v(external_id, locality, region, cc)
where s.external_id = v.external_id;
```

- [ ] **Step 2: Apply** with the Supabase `apply_migration` tool (project `kyiuhuivyugoqljqodil`, name `shop_city`).
- [ ] **Step 3: Verify** (execute_sql): `select name, locality, city_key from shops;` → Muchacho `atlanta-georgia-us`, Lazy Labrador `kennesaw-georgia-us`, Crazy Love `roswell-georgia-us`; `select name, city_key from shop_ratings;` → the 3 rated (Caribou hidden as a chain); grants on the new `log_shop_visit` = authenticated/service_role/postgres only; security + performance advisors show nothing new; a rolled-back authenticated call with a chain name still raises "chain shops can't be logged".
- [ ] **Step 4: Commit** — `git add supabase/migrations/0026_shop_city.sql && git commit -m "Shops know their city (0026)"`

---

### Task 2: Package — types, `cityKey`, logging params, `getCityShops`

**Files:**
- Create: `packages/supabase/src/city.ts`, `packages/supabase/test/city.test.ts`
- Modify: `packages/supabase/src/types.ts`, `packages/supabase/src/queries.ts`, `packages/supabase/src/index.ts`, `packages/supabase/test/queries.test.ts`

- [ ] **Step 1: Failing tests.** `packages/supabase/test/city.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { cityKey } from "../src/city";

describe("cityKey", () => {
  it("builds the same slug as the shops.city_key generated column", () => {
    expect(cityKey("Atlanta", "Georgia", "US")).toBe("atlanta-georgia-us");
    expect(cityKey("New York", "New York", "US")).toBe("new-york-new-york-us");
    expect(cityKey("St. Petersburg", "Florida", "us")).toBe("st-petersburg-florida-us");
    expect(cityKey("London", null, "GB")).toBe("london-gb");
    expect(cityKey("São Paulo", "São Paulo", "BR")).toBe("s-o-paulo-s-o-paulo-br");
  });

  it("is null without a locality", () => {
    expect(cityKey(null, "Georgia", "US")).toBeNull();
    expect(cityKey("  ", "Georgia", "US")).toBeNull();
  });
});
```
Append to `queries.test.ts` (add `getCityShops` to the import from `../src/queries`):
```ts
describe("getCityShops", () => {
  it("reads rated shops for a city key, best verdict then most logs first", async () => {
    const calls: unknown[][] = [];
    const builder: any = {
      eq: (...a: unknown[]) => { calls.push(["eq", ...a]); return builder; },
      not: (...a: unknown[]) => { calls.push(["not", ...a]); return builder; },
      order: (...a: unknown[]) => { calls.push(["order", ...a]); return builder; },
      then: (resolve: (v: unknown) => void) => resolve({ data: [{ id: "s1", name: "Muchacho" }], error: null }),
    };
    const client = { from: (t: string) => { calls.push(["from", t]); return { select: () => builder }; } } as any;
    const rows = await getCityShops(client, "atlanta-georgia-us");
    expect(rows).toEqual([{ id: "s1", name: "Muchacho" }]);
    expect(calls).toEqual([
      ["from", "shop_ratings"],
      ["eq", "city_key", "atlanta-georgia-us"],
      ["not", "rating", "is", null],
      ["order", "rating", { ascending: false }],
      ["order", "log_count", { ascending: false }],
    ]);
  });
});
```
- [ ] **Step 2: Run** `cd packages/supabase && npx vitest run` → FAIL.
- [ ] **Step 3: Implement.**

`packages/supabase/src/city.ts`:
```ts
// A city's page key, e.g. "atlanta-georgia-us". Same rule as the generated
// column shops.city_key (supabase/migrations/0026_shop_city.sql) — keep in
// step, or a search result links to a page its shops never land on.
export function cityKey(locality: string | null | undefined, region: string | null | undefined, countryCode: string | null | undefined): string | null {
  if (!locality?.trim()) return null;
  return `${locality}-${region ?? ""}-${countryCode ?? ""}`
    .replace(/[^A-Za-z0-9]+/g, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, "");
}
```
`types.ts`: in `shops` Row add `locality: string | null`, `region: string | null`, `country_code: string | null`, `city_key: string | null`; Insert/Update add `locality?`, `region?`, `country_code?` as `string | null` (not `city_key` — it's generated). In `shop_ratings` Row append `locality`, `region`, `country_code`, `city_key` (all `string | null`). In `log_shop_visit` Args add `p_locality?: string`, `p_region?: string`, `p_country_code?: string`.

`queries.ts`:
- In the `LogVisitInput` osm variant add `locality?: string | null; region?: string | null; countryCode?: string | null;`.
- In `logVisit`'s rpc call add `p_locality: input.locality ?? undefined, p_region: input.region ?? undefined, p_country_code: input.countryCode ?? undefined,`.
- Add, near `searchRatedShops`:
```ts
// A city page: every rated shop whose city_key matches, best verdict first,
// then the most-logged. A shop joins the moment it's first rated.
export async function getCityShops(client: Client, key: string) {
  const { data, error } = await client
    .from("shop_ratings")
    .select("id, name, lat, lng, neighborhood, is_snob_approved, tag, price_tier, rating, log_count, external_id, locality, region, country_code")
    .eq("city_key", key)
    .not("rating", "is", null)
    .order("rating", { ascending: false })
    .order("log_count", { ascending: false });
  if (error) throw error;
  return data;
}
```
`index.ts`: export `getCityShops` from `./queries` and `cityKey` from `./city`.
- [ ] **Step 4: Run** tests → PASS; `npx tsc --noEmit -p .` in `packages/supabase` and `apps/app` clean.
- [ ] **Step 5: Verify the slug rule against Postgres** (controller runs via execute_sql): `select btrim(lower(regexp_replace(x, '[^A-Za-z0-9]+', '-', 'g')), '-') from unnest(array['Atlanta-Georgia-US','New York-New York-US','St. Petersburg-Florida-us','London--GB','São Paulo-São Paulo-BR']) x;` → matches the test expectations above.
- [ ] **Step 6: Commit** — `git add -A packages/supabase && git commit -m "cityKey, getCityShops, city params on logVisit"`

---

### Task 3: Web — `/api/locate` (Photon reverse)

**Files:** Modify `apps/web/lib/photon.ts`, `apps/web/lib/photon.test.ts`; Create `apps/web/app/api/locate/route.ts`

- [ ] **Step 1: Failing test** (append to `photon.test.ts`; import `toLocality`):
```ts
describe("toLocality", () => {
  it("takes the city, state and country code", () => {
    expect(toLocality(feature({ osm_type: "W", osm_id: 1, osm_key: "amenity", osm_value: "restaurant", city: "Atlanta", state: "Georgia", countrycode: "US" })))
      .toEqual({ locality: "Atlanta", region: "Georgia", countryCode: "US" });
  });
  it("falls back to the county where there's no city, and to nulls with nothing", () => {
    expect(toLocality(feature({ osm_type: "W", osm_id: 2, osm_key: "highway", osm_value: "secondary", county: "Cobb", state: "Georgia", countrycode: "us" })))
      .toEqual({ locality: "Cobb", region: "Georgia", countryCode: "US" });
    expect(toLocality(undefined)).toEqual({ locality: null, region: null, countryCode: null });
  });
});
```
- [ ] **Step 2: Run** `cd apps/web && npx vitest run lib/photon.test.ts` → FAIL.
- [ ] **Step 3: Implement** in `photon.ts`: add `county?: string;` to `PhotonFeature["properties"]`, and:
```ts
export type Locality = { locality: string | null; region: string | null; countryCode: string | null };

// A shop's city for its city page (/api/locate). Unincorporated areas have no
// city in OSM, so fall back to the county rather than leave the shop off every page.
export function toLocality(f: PhotonFeature | undefined): Locality {
  const p = f?.properties;
  return {
    locality: p?.city ?? p?.county ?? null,
    region: p?.state ?? null,
    countryCode: p?.countrycode ? p.countrycode.toUpperCase() : null,
  };
}
```
`apps/web/app/api/locate/route.ts`:
```ts
import { NextResponse } from "next/server";
import { toLocality, type PhotonFeature } from "@/lib/photon";

// Which city a shop is in, for its city page — called once when a shop is
// first logged. Photon reverse geocoding (same fair-use service as /api/search).
const PHOTON_REVERSE_URL = "https://photon.komoot.io/reverse";
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };
// A place's city doesn't move; the app rounds to ~100 m so repeats share entries.
const CACHE_HEADERS = { ...CORS_HEADERS, "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!url.searchParams.get("lat") || !url.searchParams.get("lng") || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400, headers: CORS_HEADERS });
  }
  try {
    const params = new URLSearchParams({ lat: lat.toFixed(3), lon: lng.toFixed(3), lang: "en" });
    const res = await fetch(`${PHOTON_REVERSE_URL}?${params}`, {
      headers: { "User-Agent": "coffeesnob.app locate proxy (https://coffeesnob.app)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const { features } = (await res.json()) as { features: PhotonFeature[] };
    return NextResponse.json(toLocality(features[0]), { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json({ error: "Locate request failed" }, { status: 502, headers: CORS_HEADERS });
  }
}
```
- [ ] **Step 4:** `npx tsc --noEmit -p . && npx eslint lib app/api && npx vitest run` in apps/web → clean/pass. Live: `curl -s "http://localhost:3107/api/locate?lat=33.747&lng=-84.358"` → `{"locality":"Atlanta","region":"Georgia","countryCode":"US"}` (dev server: `cd apps/web && npx next dev -p 3107`).
- [ ] **Step 5: Commit** — `git add -A apps/web && git commit -m "Add /api/locate (Photon reverse) for a shop's city"`

---

### Task 4: App — capture the city when logging a new shop

**Files:** Create `apps/app/lib/log/locate.ts`, `apps/app/lib/log/locate.test.ts`; Modify `apps/app/components/log/log-form.tsx`

- [ ] **Step 1: Failing test** `apps/app/lib/log/locate.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { locateShop } from "./locate";

afterEach(() => vi.unstubAllGlobals());

describe("locateShop", () => {
  it("asks /api/locate with coordinates rounded to ~100 m", async () => {
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ locality: "Atlanta", region: "Georgia", countryCode: "US" }) }));
    vi.stubGlobal("fetch", fetchSpy);
    expect(await locateShop(33.74712, -84.35801, "https://example.com")).toEqual({ locality: "Atlanta", region: "Georgia", countryCode: "US" });
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/api/locate?lat=33.747&lng=-84.358");
  });

  it("never blocks logging: failures and timeouts give an empty location", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 502 })));
    expect(await locateShop(1, 2, "https://example.com")).toEqual({});
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    expect(await locateShop(1, 2, "https://example.com")).toEqual({});
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const pending = locateShop(1, 2, "https://example.com");
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toEqual({});
    vi.useRealTimers();
  });
});
```
- [ ] **Step 2: Run** `cd apps/app && npx vitest run lib/log/locate.test.ts` → FAIL.
- [ ] **Step 3: Implement** `apps/app/lib/log/locate.ts`:
```ts
export type ShopLocation = { locality?: string | null; region?: string | null; countryCode?: string | null };

const TIMEOUT_MS = 2500;

// Which city a newly logged shop is in (web /api/locate), so it lands on its
// city page. Best effort: a failure or slow answer logs the visit without it
// rather than holding up Publish.
export async function locateShop(lat: number, lng: number, webAppUrl: string): Promise<ShopLocation> {
  const params = new URLSearchParams({ lat: lat.toFixed(3), lng: lng.toFixed(3) });
  const lookup = fetch(`${webAppUrl}/api/locate?${params}`)
    .then((r) => (r.ok ? (r.json() as Promise<ShopLocation>) : {}))
    .catch(() => ({}));
  const timeout = new Promise<ShopLocation>((resolve) => setTimeout(() => resolve({}), TIMEOUT_MS));
  return Promise.race([lookup, timeout]);
}
```
- [ ] **Step 4: Wire into `log-form.tsx`'s `publish()`.** Change `const input = buildLogVisitInput(params, { rating, drink, note });` to `let input = …` (keep the `if (!input) return;`), and right after `setError(null);` (inside the try, before `logVisit`) add:
```ts
      // A new shop from OSM: find its city so it lands on that city's page.
      if (input.kind === "osm") {
        input = { ...input, ...(await locateShop(input.lat, input.lng, WEB_APP_URL)) };
      }
```
with `import { locateShop } from "../../lib/log/locate";` and a module constant `const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? "";` (same as map.tsx). Make sure the lookup happens inside the existing try so any surprise still shows the existing error message.
- [ ] **Step 5:** `npx vitest run && npx tsc --noEmit -p .` in apps/app → pass/clean.
- [ ] **Step 6: Commit** — `git add -A apps/app && git commit -m "Record a new shop's city when it's logged"`

---

### Task 5: App — city page

**Files:** Create `apps/app/lib/city/use-city.ts`, `apps/app/app/(tabs)/city/[slug].tsx`; Modify `apps/app/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Hook** `apps/app/lib/city/use-city.ts` (framework glue like `useShop`, not unit tested):
```ts
import { useCallback, useEffect, useState } from "react";
import { getCityShops } from "@coffeesnob/supabase";
import { toRatedShopPin } from "../map/nearby-map-data";
import type { RatedShopPin } from "../../components/map/types";

export type CityState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; shops: RatedShopPin[]; locality: string | null; region: string | null };

// ponytail: fetch-on-mount glue, same category as useShop.
export function useCity(key: string | undefined) {
  const [state, setState] = useState<CityState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!key) {
      setState({ status: "ready", shops: [], locality: null, region: null });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    const { supabase } = require("../supabase");
    getCityShops(supabase, key)
      .then((rows) => {
        if (cancelled) return;
        setState({ status: "ready", shops: rows.map(toRatedShopPin), locality: rows[0]?.locality ?? null, region: rows[0]?.region ?? null });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
```
- [ ] **Step 2: Screen** `apps/app/app/(tabs)/city/[slug].tsx`:
```tsx
import { ActivityIndicator, FlatList, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { Body, BodySm, ButtonLine, ButtonOx, D2, Label } from "@/components/primitives";
import { ShopRow } from "@/components/map/shop-row";
import { useCity } from "@/lib/city/use-city";
import { isDesktopWidth } from "@/lib/nav";

// Every rated shop in a city, best verdict first. A shop joins the moment it's
// first rated; curated "best in city" guides come later, built on top of this.
export default function CityScreen() {
  const { slug, name, lat, lng } = useLocalSearchParams<{ slug: string; name?: string; lat?: string; lng?: string }>();
  const { width } = useWindowDimensions();
  const wide = isDesktopWidth(width);
  const { state, retry } = useCity(slug);

  const title = (state.status === "ready" && state.locality) || name || "This city";
  const seeMap = () => router.push(lat && lng ? { pathname: "/map", params: { lat, lng } } : "/map");

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper }}>
        <ActivityIndicator color={colors.ink3} accessibilityLabel="Loading city" />
      </View>
    );
  }
  if (state.status === "error") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24, backgroundColor: colors.paper }}>
        <Body style={{ textAlign: "center", color: colors.ink3 }}>Couldn't load this city. Check your connection and try again.</Body>
        <ButtonOx title="Try again" onPress={retry} accessibilityRole="button" accessibilityLabel="Try again" />
      </View>
    );
  }

  const count = state.shops.length;
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ width: "100%", maxWidth: 720, alignSelf: "center", paddingBottom: 32 }}
      data={state.shops}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => (
        <ShopRow row={{ kind: "rated", shop: item, distanceKm: null }} active={false} wide={wide} onPress={() => router.push(`/shop/${item.id}`)} />
      )}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, gap: 6, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
          <Label>City</Label>
          <D2 accessibilityRole="header">{title}</D2>
          {count > 0 ? <BodySm>{`${count} rated ${count === 1 ? "shop" : "shops"}, best verdict first`}</BodySm> : null}
        </View>
      }
      ListEmptyComponent={
        <View style={{ padding: 24, gap: 16, alignItems: "flex-start" }}>
          <Body style={{ color: colors.ink2 }}>No verdicts here yet. Be the first — every café is on the map.</Body>
          <ButtonLine title="See every café on the map" onPress={seeMap} accessibilityRole="button" accessibilityLabel="See every café on the map" />
        </View>
      }
    />
  );
}
```
(If `rowSubtitle`'s "Logged by the community" fallback reads oddly here, leave it — it's the map list's wording.)
- [ ] **Step 3: Register** in `apps/app/app/(tabs)/_layout.tsx` next to `shop/[id]`: `<Tabs.Screen name="city/[slug]" options={{ href: null }} />`. If the desktop rail/other nav lists routes explicitly, check it doesn't need the same (grep for `"shop/[id]"`).
- [ ] **Step 4:** `npx tsc --noEmit -p . && npx vitest run` in apps/app → clean/pass.
- [ ] **Step 5: Commit** — `git add -A apps/app && git commit -m "City page: every rated shop in a city"`

---

### Task 6: App — "Best in <city>" from search (only for cities with verdicts)

**Owner decision (2026-09-24):** a city with no rated shops has no page at all — no empty "No verdicts here yet" page, no link to one. The city page redirects to the map if its city has no rated shops (Task 5), and search only offers "Best in <city>" when that city has at least one.

**Files:** Modify `apps/web/lib/photon.ts` (+test), `apps/web/app/api/search/route.ts`, `packages/supabase/src/queries.ts` (+test, + index export), `apps/app/lib/map/geocode.ts` (Place type), `apps/app/components/map/map-search.tsx`

- [ ] **Step 1: Places carry a candidate city key.** In `apps/web/lib/photon.ts` add `cityKey?: string | null` to `Place`, set for city-level places: `cityKey: ["city", "town", "village", "hamlet"].includes(p.osm_value) ? cityKey(p.name, p.state, p.countrycode) : null` (import `cityKey` from "@coffeesnob/supabase"). Update `photon.test.ts`: the Atlanta city expectation gains `cityKey: "atlanta-georgia-us"`; state/country places get `cityKey: null`.
- [ ] **Step 2: Only cities with verdicts keep their key.** Add to `packages/supabase/src/queries.ts` (export from index; test with a fake client asserting `.from("shop_ratings").select("city_key").in("city_key", keys).not("rating", "is", null)` and that it returns the distinct set):
```ts
// Which of these cities have at least one rated shop (i.e. have a page).
export async function citiesWithVerdicts(client: Client, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const { data, error } = await client.from("shop_ratings").select("city_key").in("city_key", keys).not("rating", "is", null);
  if (error) throw error;
  return new Set(data.map((r) => r.city_key).filter((k): k is string => k !== null));
}
```
In `apps/web/app/api/search/route.ts`, after building `places`: collect their non-null `cityKey`s, call `citiesWithVerdicts(getSupabase(), keys)` (import `getSupabase` from "@/lib/supabase"), and null out any `cityKey` not in the set. If that call throws, null them all (no links) and send `CORS_HEADERS` instead of `CACHE_HEADERS` so the degraded answer isn't cached. A newly rated city's link appears within the 1h CDN window — fine.
- [ ] **Step 3: Search row link.** In `apps/app/lib/map/geocode.ts` add `cityKey?: string | null` to `Place`. In `map-search.tsx`, for `r.kind === "place"` rows with a `cityKey`, render a trailing pressable after the text:
```tsx
{r.kind === "place" && r.place.cityKey ? (
  <Pressable
    onPress={() => {
      close();
      router.push({ pathname: "/city/[slug]", params: { slug: r.place.cityKey!, name: r.place.primary } });
    }}
    accessibilityRole="link"
    accessibilityLabel={`Best in ${r.place.primary}`}
    hitSlop={8}
  >
    <Label style={{ color: colors.oxblood }}>{`Best in ${r.place.primary}`}</Label>
  </Pressable>
) : null}
```
Lay the row out as a row (`flexDirection: "row"`, text column `flex: 1`) so the link sits at the right; tapping the rest of the row still flies the map as today. Import `router` from "expo-router".
- [ ] **Step 4:** packages/supabase, apps/web, apps/app: `npx tsc --noEmit -p . && npx vitest run` → clean/pass. Live: `/api/search?q=atlanta&lat=36.2&lng=-86.8` → Atlanta, GA has `cityKey: "atlanta-georgia-us"`; `/api/search?q=nashville` → Nashville's `cityKey` is null.
- [ ] **Step 5: Commit** — `git add -A apps packages && git commit -m "Search links to city pages that have verdicts"`

---

### Task 7: Verify and ship (controller)

- [ ] Full checks + both builds (web `next build`, app `expo export -p web`), packages tests.
- [ ] Live: `/api/search?q=atlanta` place has `cityKey: "atlanta-georgia-us"`, Nashville's is null; `/api/locate` returns Atlanta for Muchacho's coordinates; headless Chrome on `http://localhost:8123/city/atlanta-georgia-us` (Expo web against the local API) shows Muchacho; `/city/nashville-tennessee-us` redirects to the map.
- [ ] Final whole-branch review (opus) → fix → tracker line → merge to main → push → confirm production `/api/locate` and the city page.
