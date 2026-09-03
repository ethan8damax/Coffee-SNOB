# Map Shop Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend data layer for the map feature — split Snob-Approved curation out of the `shops` table into a layered `shop_curations` table, add the log-driven promotion pipeline, and stand up a live OpenStreetMap proxy for the "any shop nearby" layer — per `docs/superpowers/specs/2026-09-03-map-community-shops-design.md`.

**Architecture:** `shops` becomes a base identity table for every shop we've ever touched (curated or logged); a `shop_curations` row existing is what "Snob-Approved" means. A `logs`-insert trigger flags a shop for review once it crosses a log-count/rating threshold. A `log_shop_visit` Postgres function atomically creates a shop (by OpenStreetMap id) and its first log in one call, since there's no public insert policy on `shops`. A `shop_ratings` view gives the map a single, queryable source for "shops worth putting a rated pin on." A new Next.js API route proxies live Overpass queries with a short-lived per-tile cache.

**Tech Stack:** Postgres/Supabase (migrations, RLS, plpgsql), `@coffeesnob/supabase` (typed queries), Next.js route handlers (`apps/web`), Vitest.

**Out of scope (see spec):** the admin Candidates UI (blocked on a Claude Design mockup — not started), the map screen itself (separate plan, `2026-09-03-map-screen.md`), Mapbox Studio styling.

---

### Task 1: Add a test runner to `apps/web`

`apps/web` has no test script today (`packages/supabase` and `apps/app` both use zero-config Vitest — no `vitest.config.*` file needed). This plan adds real branching logic to `apps/web` for the first time, so bring it up to the same baseline.

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add the `test` script and `vitest` devDependency**

In `apps/web/package.json`, add to `"scripts"`:
```json
"test": "vitest run"
```
And add to `"devDependencies"`:
```json
"vitest": "^2.1.8"
```
(matches the version already pinned in `apps/app/package.json`)

- [ ] **Step 2: Install and verify the runner works with no tests yet**

Run: `pnpm install && pnpm --filter web test`
Expected: Vitest reports "No test files found" (not an error) — confirms the runner is wired up before any tests exist.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "test: add vitest to apps/web"
```

---

### Task 2: Migration — split `shop_curations` out of `shops`

**Files:**
- Create: `supabase/migrations/0008_shop_curations.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Split shop curation content into its own table, layered on top of a
-- shop's base identity (see docs/superpowers/specs/2026-09-03-map-
-- community-shops-design.md). A shop_curations row existing IS what
-- "Snob-Approved" means — no boolean/enum needed. shops gains what a
-- shop needs when it only exists because someone logged a visit to a
-- live OpenStreetMap result: external_id for dedup, and city_id/
-- neighborhood become optional since such a shop may be outside every
-- city we've launched.

alter table public.shops
  add column external_id text,
  add column promotion_status text not null default 'none'
    check (promotion_status in ('none', 'flagged', 'rejected')),
  alter column city_id drop not null,
  alter column neighborhood drop not null;

create unique index shops_external_id_key on public.shops (external_id)
  where external_id is not null;

create table public.shop_curations (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  writeup text,
  order_note text,
  editorial_rating smallint check (editorial_rating between 1 and 5),
  tag text,
  price_tier text not null default '€€' check (price_tier in ('€', '€€', '€€€')),
  created_at timestamptz not null default now()
);

alter table public.shop_curations enable row level security;
create policy "shop curations are publicly readable" on public.shop_curations for select using (true);

-- Every existing shops row today is a curated one (nothing else was
-- possible before this migration) — move that content onto the new layer.
insert into public.shop_curations (shop_id, writeup, order_note, editorial_rating, tag, price_tier)
select id, writeup, order_note, editorial_rating, tag, price_tier from public.shops;

alter table public.shops
  drop column writeup,
  drop column order_note,
  drop column editorial_rating,
  drop column tag,
  drop column price_tier;
```

- [ ] **Step 2: Apply the migration to the dev database and verify**

Run: `psql "$DEV_DATABASE_URL" -f supabase/migrations/0008_shop_curations.sql`

Then verify the data moved correctly:
```bash
psql "$DEV_DATABASE_URL" -c "select count(*) from public.shops;" \
  -c "select count(*) from public.shop_curations;"
```
Expected: both counts equal the pre-migration shop count (every shop got a curation row), and:
```bash
psql "$DEV_DATABASE_URL" -c "\d public.shops" -c "\d public.shop_curations"
```
Expected: `shops` no longer lists `writeup`/`order_note`/`editorial_rating`/`tag`/`price_tier`; `shop_curations` lists them; `shops.city_id` and `shops.neighborhood` show `nullable`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_shop_curations.sql
git commit -m "feat: split shop_curations out of shops"
```

---

### Task 3: Update `packages/supabase/src/types.ts` for the new shape

**Files:**
- Modify: `packages/supabase/src/types.ts:248-300` (the `shops` table type)

- [ ] **Step 1: Update the `shops` table type**

Replace the existing `shops` entry (lines 248-300) with:

```typescript
      shops: {
        Row: {
          city_id: string | null
          created_at: string
          external_id: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          neighborhood: string | null
          promotion_status: string
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          neighborhood?: string | null
          promotion_status?: string
        }
        Update: {
          city_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          neighborhood?: string | null
          promotion_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shops_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_curations: {
        Row: {
          created_at: string
          editorial_rating: number | null
          order_note: string | null
          price_tier: string
          shop_id: string
          tag: string | null
          writeup: string | null
        }
        Insert: {
          created_at?: string
          editorial_rating?: number | null
          order_note?: string | null
          price_tier?: string
          shop_id: string
          tag?: string | null
          writeup?: string | null
        }
        Update: {
          created_at?: string
          editorial_rating?: number | null
          order_note?: string | null
          price_tier?: string
          shop_id?: string
          tag?: string | null
          writeup?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_curations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
```

- [ ] **Step 2: Verify the workspace still typechecks**

Run: `pnpm --filter @coffeesnob/supabase typecheck`
Expected: fails, listing `packages/supabase/src/queries.ts` (the `getCityGuide` select string still references the old flat shape) — confirms the type change is live. This gets fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add packages/supabase/src/types.ts
git commit -m "types: split shop_curations out of shops in Database types"
```

---

### Task 4: Update `getCityGuide` for the new join shape

**Files:**
- Modify: `packages/supabase/src/queries.ts:37-49`
- Test: `packages/supabase/test/queries.test.ts:103-144`

- [ ] **Step 1: Update the failing test's fixtures first**

In `packages/supabase/test/queries.test.ts`, update the `getCityGuide` test titled `"returns { city, guide } when both exist"` (around line 120) to reflect the nested shape:

```typescript
  it("returns { city, guide } when both exist", async () => {
    const city = { id: "1", slug: "lisbon", name: "Lisbon" };
    const guide = {
      id: "g1",
      slug: "lisbon-guide",
      title: "Lisbon Guide",
      list_items: [
        {
          position: 1,
          note: null,
          shops: {
            id: "s1",
            name: "Noi Coffee",
            neighborhood: "Príncipe Real",
            shop_curations: { price_tier: "€€", tag: "Espresso bar", writeup: "Great bar.", order_note: null, editorial_rating: 5 },
          },
        },
      ],
    };
    const client = fakeGuideClient(
      { data: city, error: null },
      { data: guide, error: null }
    );
    const result = await getCityGuide(client, "lisbon");
    expect(result).toEqual({ city, guide });
  });
```

- [ ] **Step 2: Run the test to confirm it still passes against the old query (sanity check the fixture change alone doesn't break anything)**

Run: `pnpm --filter @coffeesnob/supabase test -- queries.test.ts -t "getCityGuide"`
Expected: PASS (the fake client just echoes back whatever `guideResult.data` you give it — the shape of the mock data doesn't depend on the real select string, so this passes regardless. The real proof this task did something comes from Step 4's typecheck.)

- [ ] **Step 3: Update the `getCityGuide` select string**

In `packages/supabase/src/queries.ts`, change the `guide` select (around line 40):

```typescript
  const { data: guide, error: guideError } = await client
    .from("lists")
    .select(
      "id, slug, title, description, body, cover_photo_alt, save_count, list_items(position, note, shops(id, name, neighborhood, shop_curations(price_tier, tag, writeup, order_note, editorial_rating)))"
    )
    .eq("type", "city_guide")
    .eq("city_id", city.id)
    .order("position", { referencedTable: "list_items" })
    .maybeSingle();
```

(only the select string's shop fields change — `price_tier, tag, writeup, order_note, editorial_rating` become `shop_curations(price_tier, tag, writeup, order_note, editorial_rating)`)

- [ ] **Step 4: Run the full test suite and typecheck**

Run: `pnpm --filter @coffeesnob/supabase test && pnpm --filter @coffeesnob/supabase typecheck`
Expected: all tests PASS, typecheck PASSES (this also confirms Task 3's type change is now consistent with actual usage).

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/src/queries.ts packages/supabase/test/queries.test.ts
git commit -m "feat: join shop_curations in getCityGuide"
```

---

### Task 5: Update the city-guide page consumer

**Files:**
- Modify: `apps/web/app/city-guides/[slug]/page.tsx:40-54`

- [ ] **Step 1: Update the render loop to read through `shop_curations`**

Replace lines 40-54 of `apps/web/app/city-guides/[slug]/page.tsx`:

```tsx
              {items.map(({ shops: s, note }) => {
                const c = s.shop_curations;
                return (
                  <li key={s.id} className="srow">
                    <div className="photo-ph srow-ph" data-label={`${s.name} — counter`} />
                    <div className="srow-body">
                      <div className="srow-head">
                        <h3 className="d3">{s.name}</h3>
                        <span className="label">{s.neighborhood} · {c?.tag} · {c?.price_tier}</span>
                      </div>
                      <p className="body" style={{ marginTop: 10 }}>{c?.writeup}</p>
                      {c?.order_note && <p style={{ marginTop: 8 }}><span className="label">Order</span> <span className="body">{c.order_note}</span></p>}
                      {note && <p className="fine">{note}</p>}
                    </div>
                    {c?.editorial_rating != null && <div className="srow-rating"><Detour value={c.editorial_rating} short /></div>}
                  </li>
                );
              })}
```

(`shop_curations` is typed nullable since not every `shops` row has one, even though every shop reachable through a city guide's `list_items` is curated by construction — the optional chaining is a cheap guard against that not being a real DB constraint)

- [ ] **Step 2: Verify the web app typechecks**

Run: `pnpm --filter web typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/city-guides/[slug]/page.tsx
git commit -m "fix: read shop curation fields through shop_curations"
```

---

### Task 6: Update `supabase/seed.dev.sql` for the split shape

**Files:**
- Modify: `supabase/seed.dev.sql:10-35`

- [ ] **Step 1: Split the single shops insert into base + curation inserts**

Replace lines 10-35 of `supabase/seed.dev.sql`:

```sql
with lisbon as (select id from public.cities where slug = 'lisbon'),
     inserted as (
       insert into public.shops (city_id, name, neighborhood)
       select lisbon.id, s.name, s.neighborhood
       from lisbon, (values
         ('Noi Coffee', 'Príncipe Real'),
         ('Fábrica Coffee Roasters', 'Baixa'),
         ('Copenhagen Coffee Lab', 'Príncipe Real'),
         ('Olisipo Roastery', 'Alcântara'),
         ('Café Graça', 'Graça'),
         ('Tartine Baixa', 'Baixa'),
         ('Comoba', 'Cais do Sodré')
       ) as s(name, neighborhood)
       returning id, name
     )
insert into public.shop_curations (shop_id, price_tier, tag, writeup, order_note, editorial_rating)
select inserted.id, c.price_tier, c.tag, c.writeup, c.order_note, c.editorial_rating
from inserted
join (values
  ('Noi Coffee', '€€', 'Espresso bar',
   'The best-run bar in the country. Two grinders, one Ethiopian on filter, and a barista who will ask what you drank yesterday. Order at the counter and stay standing.',
   'Filter — whatever is newest', 5::smallint),
  ('Fábrica Coffee Roasters', '€€', 'Roaster',
   'Roasts in the back, sells across the counter, and does not pretend the room is anything other than a workshop. The cortado is the control sample.',
   'Cortado, plus a bag of the Colombian', 4::smallint),
  ('Copenhagen Coffee Lab', '€€', 'Filter focus',
   'Nordic import that made light roast normal here. Bright, consistent, occasionally too full to sit. The pastry is better than it needs to be.',
   'V60, single origin', 4::smallint),
  ('Olisipo Roastery', '€€€', 'Roaster',
   'A working roastery with a cupping table open to the public on Fridays. Ask about the Brazilian naturals if the door is open.',
   'Whatever is on the cupping table', 4::smallint),
  ('Café Graça', '€', 'Neighbourhood',
   'Not a specialty room and not trying to be. Good beans, old tiles, three tables outside facing the wrong way for the view — which is the point.',
   'Espresso, one sugar, standing', 3::smallint),
  ('Tartine Baixa', '€€', 'Bakery bar',
   'Coffee is a strong second act to the bread. Reroute if you are already walking past; do not plan a morning around it.',
   'Flat white and the sourdough', 3::smallint),
  ('Comoba', '€€', 'All-day',
   'Pleasant, busy, and fine. The kitchen is the reason to come; the coffee follows the room rather than leading it.',
   'Breakfast, coffee incidental', 2::smallint)
) as c(name, price_tier, tag, writeup, order_note, editorial_rating) on c.name = inserted.name;
```

- [ ] **Step 2: Run it against a scratch database and verify**

Run: `psql "$DEV_DATABASE_URL" -f supabase/seed.dev.sql` (against a fresh/scratch dev DB, not one with existing Lisbon data — the fixture already assumes a clean slate per its own header comment)

Then:
```bash
psql "$DEV_DATABASE_URL" -c "select s.name, sc.price_tier, sc.editorial_rating from public.shops s join public.shop_curations sc on sc.shop_id = s.id order by s.name;"
```
Expected: all 7 Lisbon shops listed with their correct price tier and rating.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.dev.sql
git commit -m "fix: update dev seed fixture for split shop_curations table"
```

---

### Task 7: Migration — promotion trigger

**Files:**
- Create: `supabase/migrations/0009_shop_promotion_trigger.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Flags a shop for Snob-Approval review once our own users' logs cross a
-- log-count + average-rating bar (see docs/superpowers/specs/2026-09-03-
-- map-community-shops-design.md). This is a "worth a visit" signal, not
-- an approval — the two-visit human standard in CURATION-STANDARDS.md is
-- unchanged. min_logs/min_avg are named constants below so raising them
-- later, expected as the app grows, is a one-line change.
create or replace function public.check_shop_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_count integer;
  v_avg_rating numeric;
  v_min_logs constant integer := 5;
  v_min_avg constant numeric := 4.2;
begin
  select count(*), avg(rating) into v_log_count, v_avg_rating
  from public.logs
  where shop_id = new.shop_id;

  if v_log_count >= v_min_logs and v_avg_rating >= v_min_avg then
    update public.shops
    set promotion_status = 'flagged'
    where id = new.shop_id
      and promotion_status = 'none'
      and not exists (select 1 from public.shop_curations where shop_id = new.shop_id);
  end if;

  return new;
end;
$$;

create trigger on_log_insert_check_promotion
  after insert on public.logs
  for each row execute function public.check_shop_promotion();
```

- [ ] **Step 2: Apply and verify with a real insert**

Run: `psql "$DEV_DATABASE_URL" -f supabase/migrations/0009_shop_promotion_trigger.sql`

Then exercise the trigger directly:
```bash
psql "$DEV_DATABASE_URL" <<'SQL'
-- a throwaway shop + user + 5 logs averaging 4.4, using the real seeded
-- test user's id (substitute one from `select id from auth.users limit 1`)
with u as (select id from auth.users limit 1),
     s as (insert into public.shops (name) values ('Trigger Test Shop') returning id)
insert into public.logs (user_id, shop_id, rating)
select u.id, s.id, r from u, s, unnest(array[4,4,5,5,4]) as r;

select id, name, promotion_status from public.shops where name = 'Trigger Test Shop';
SQL
```
Expected: `promotion_status` is `flagged`.

Then verify it does NOT flag below threshold:
```bash
psql "$DEV_DATABASE_URL" <<'SQL'
with u as (select id from auth.users limit 1),
     s as (insert into public.shops (name) values ('Trigger Test Shop 2') returning id)
insert into public.logs (user_id, shop_id, rating) select u.id, s.id, 3 from u, s;

select id, name, promotion_status from public.shops where name = 'Trigger Test Shop 2';
SQL
```
Expected: `promotion_status` is `none` (1 log, below the 5-log minimum).

Clean up the throwaway rows:
```bash
psql "$DEV_DATABASE_URL" -c "delete from public.shops where name in ('Trigger Test Shop', 'Trigger Test Shop 2');"
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0009_shop_promotion_trigger.sql
git commit -m "feat: flag shops for review once logs cross the promotion threshold"
```

---

### Task 8: Migration — `shop_ratings` view

**Files:**
- Create: `supabase/migrations/0010_shop_ratings_view.sql`

- [ ] **Step 1: Write the migration**

```sql
-- A shop earns a "rated" pin on the map once it's either Snob-Approved or
-- has at least one of our own users' logs — using the curated rating when
-- one exists, otherwise the rounded average of its logs (see
-- docs/superpowers/specs/2026-09-03-map-community-shops-design.md,
-- "Map rendering / integration"). security_invoker means this view runs
-- with the querying role's own privileges, so it's governed by the
-- existing public-read RLS policies on shops/shop_curations/logs — no
-- separate grant needed, same as every other table in this schema.
create view public.shop_ratings
with (security_invoker = true)
as
select
  s.id,
  s.name,
  s.lat,
  s.lng,
  s.city_id,
  s.neighborhood,
  (sc.shop_id is not null) as is_snob_approved,
  sc.tag,
  sc.price_tier,
  coalesce(sc.editorial_rating, round(avg(l.rating))::smallint) as rating,
  count(l.id) as log_count
from public.shops s
left join public.shop_curations sc on sc.shop_id = s.id
left join public.logs l on l.shop_id = s.id
group by s.id, sc.shop_id, sc.tag, sc.price_tier, sc.editorial_rating
having sc.shop_id is not null or count(l.id) > 0;
```

- [ ] **Step 2: Apply and verify as the `anon` role specifically (not just as the migration-running superuser)**

Run: `psql "$DEV_DATABASE_URL" -f supabase/migrations/0010_shop_ratings_view.sql`

Then confirm the security_invoker assumption actually holds for the roles PostgREST uses:
```bash
psql "$DEV_DATABASE_URL" -c "set role anon; select count(*) from public.shop_ratings; reset role;"
```
Expected: succeeds and returns 7 (the seeded Lisbon shops, all curated). If this errors with a permissions failure instead, the view needs an explicit `grant select on public.shop_ratings to anon, authenticated;` added to the migration — add it and re-run this step.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0010_shop_ratings_view.sql
git commit -m "feat: add shop_ratings view for map pin queries"
```

---

### Task 9: Migration — `log_shop_visit` RPC

**Files:**
- Create: `supabase/migrations/0011_log_shop_visit.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Atomically upserts a shop by its OpenStreetMap id (a shops row for a
-- live OSM result is only created the first time someone logs a visit to
-- it — see docs/superpowers/specs/2026-09-03-map-community-shops-
-- design.md) and inserts the log, in one round trip. security definer
-- because creating the shops row needs an insert that authenticated users
-- have no direct policy for (curated shops still only come from the
-- admin dashboard) — auth.uid() is checked explicitly inside rather than
-- trusted from the caller, since a definer function runs with elevated
-- privilege regardless of who calls it.
create or replace function public.log_shop_visit(
  p_external_id text,
  p_name text,
  p_lat double precision,
  p_lng double precision,
  p_rating smallint,
  p_note text default null,
  p_visited_at date default current_date
)
returns public.logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
  v_log public.logs;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated to log a visit';
  end if;

  insert into public.shops (external_id, name, lat, lng)
  values (p_external_id, p_name, p_lat, p_lng)
  on conflict (external_id) do update set name = excluded.name
  returning id into v_shop_id;

  insert into public.logs (user_id, shop_id, rating, note, visited_at)
  values (auth.uid(), v_shop_id, p_rating, p_note, coalesce(p_visited_at, current_date))
  returning * into v_log;

  return v_log;
end;
$$;

revoke all on function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date) from public;
grant execute on function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date) to authenticated;
```

- [ ] **Step 2: Apply and verify both the happy path and the auth check**

Run: `psql "$DEV_DATABASE_URL" -f supabase/migrations/0011_log_shop_visit.sql`

Verify unauthenticated calls are rejected:
```bash
psql "$DEV_DATABASE_URL" -c "set role anon; select public.log_shop_visit('node/1', 'Test Cafe', 38.7, -9.1, 4::smallint); reset role;"
```
Expected: error `must be authenticated to log a visit` (as `anon`, `auth.uid()` is null).

Verify the authenticated happy path and dedup, using a real user id:
```bash
psql "$DEV_DATABASE_URL" <<'SQL'
select set_config('request.jwt.claim.sub', (select id::text from auth.users limit 1), true);
set role authenticated;
select public.log_shop_visit('node/999', 'Corner Cafe', 38.71, -9.14, 5::smallint, 'Great flat white');
select public.log_shop_visit('node/999', 'Corner Cafe', 38.71, -9.14, 4::smallint);
reset role;

select id, external_id, name from public.shops where external_id = 'node/999';
select count(*) from public.logs l join public.shops s on s.id = l.shop_id where s.external_id = 'node/999';
SQL
```
Expected: exactly one `shops` row for `node/999` (the second call updated, not duplicated) and two `logs` rows pointing at it.

Clean up:
```bash
psql "$DEV_DATABASE_URL" -c "delete from public.shops where external_id = 'node/999';"
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0011_log_shop_visit.sql
git commit -m "feat: add log_shop_visit RPC for lazily-created community shops"
```

---

### Task 10: Add `getRatedShopsInBounds` and `logShopVisit` queries

**Files:**
- Modify: `packages/supabase/src/queries.ts`
- Test: `packages/supabase/test/queries.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/supabase/test/queries.test.ts`:

```typescript
describe("getRatedShopsInBounds", () => {
  it("queries shop_ratings within the given lat/lng box", async () => {
    const geSpy = vi.fn(() => ({ lte: vi.fn(() => ({ gte: vi.fn(() => ({ lte: () => Promise.resolve({ data: [{ id: "s1", name: "Noi Coffee" }], error: null }) })) })) }));
    const selectSpy = vi.fn(() => ({ gte: geSpy }));
    const client = { from: () => ({ select: selectSpy }) } as any;

    const shops = await getRatedShopsInBounds(client, { minLat: 38.7, maxLat: 38.8, minLng: -9.2, maxLng: -9.1 });

    expect(shops).toEqual([{ id: "s1", name: "Noi Coffee" }]);
    expect(selectSpy).toHaveBeenCalledWith("id, name, lat, lng, neighborhood, is_snob_approved, tag, price_tier, rating, log_count");
  });

  it("throws when the client returns an error", async () => {
    const client = {
      from: () => ({
        select: () => ({
          gte: () => ({ lte: () => ({ gte: () => ({ lte: () => Promise.resolve({ data: null, error: new Error("boom") }) }) }) }),
        }),
      }),
    } as any;
    await expect(
      getRatedShopsInBounds(client, { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 })
    ).rejects.toThrow("boom");
  });
});

describe("logShopVisit", () => {
  it("calls the log_shop_visit RPC with snake_case params", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: { id: "l1" }, error: null }));
    const client = { rpc: rpcSpy } as any;

    const log = await logShopVisit(client, {
      externalId: "node/1",
      name: "Corner Cafe",
      lat: 38.7,
      lng: -9.1,
      rating: 5,
      note: "Great",
    });

    expect(log).toEqual({ id: "l1" });
    expect(rpcSpy).toHaveBeenCalledWith("log_shop_visit", {
      p_external_id: "node/1",
      p_name: "Corner Cafe",
      p_lat: 38.7,
      p_lng: -9.1,
      p_rating: 5,
      p_note: "Great",
      p_visited_at: undefined,
    });
  });

  it("throws when the RPC returns an error", async () => {
    const client = { rpc: () => Promise.resolve({ data: null, error: new Error("must be authenticated to log a visit") }) } as any;
    await expect(
      logShopVisit(client, { externalId: "node/1", name: "Corner Cafe", lat: 38.7, lng: -9.1, rating: 5 })
    ).rejects.toThrow("must be authenticated to log a visit");
  });
});
```

And update the import line at the top of the file to include the two new functions:
```typescript
import { getCities, getCitiesWithShopCounts, getCityGuide, getProfile, isUsernameAvailable, saveIdentity, saveTastePicks, getRatedShopsInBounds, logShopVisit } from "../src/queries";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @coffeesnob/supabase test -- queries.test.ts -t "getRatedShopsInBounds|logShopVisit"`
Expected: FAIL with `getRatedShopsInBounds is not a function` / `logShopVisit is not a function`

- [ ] **Step 3: Implement both functions**

Append to `packages/supabase/src/queries.ts`:

```typescript
export async function getRatedShopsInBounds(
  client: Client,
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }
) {
  const { data, error } = await client
    .from("shop_ratings")
    .select("id, name, lat, lng, neighborhood, is_snob_approved, tag, price_tier, rating, log_count")
    .gte("lat", bounds.minLat)
    .lte("lat", bounds.maxLat)
    .gte("lng", bounds.minLng)
    .lte("lng", bounds.maxLng);
  if (error) throw error;
  return data;
}

export async function logShopVisit(
  client: Client,
  params: { externalId: string; name: string; lat: number; lng: number; rating: number; note?: string; visitedAt?: string }
) {
  const { data, error } = await client.rpc("log_shop_visit", {
    p_external_id: params.externalId,
    p_name: params.name,
    p_lat: params.lat,
    p_lng: params.lng,
    p_rating: params.rating,
    p_note: params.note,
    p_visited_at: params.visitedAt,
  });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 4: Run the tests to verify they pass, then the full suite + typecheck**

Run: `pnpm --filter @coffeesnob/supabase test && pnpm --filter @coffeesnob/supabase typecheck`
Expected: all PASS. (`shop_ratings` and the `log_shop_visit` RPC signature both need to already be present in `types.ts` for `client.from("shop_ratings")` / `client.rpc("log_shop_visit", ...)` to typecheck — add a `Views: { shop_ratings: { Row: { id: string; name: string; lat: number | null; lng: number | null; city_id: string | null; neighborhood: string | null; is_snob_approved: boolean; tag: string | null; price_tier: string | null; rating: number | null; log_count: number } } }` entry and a `Functions: { log_shop_visit: { Args: { p_external_id: string; p_name: string; p_lat: number; p_lng: number; p_rating: number; p_note?: string; p_visited_at?: string }; Returns: Tables<"logs"> } }` entry to `packages/supabase/src/types.ts` if the typecheck fails on either.)

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/src/queries.ts packages/supabase/src/types.ts packages/supabase/test/queries.test.ts
git commit -m "feat: add getRatedShopsInBounds and logShopVisit queries"
```

---

### Task 11: Nearby-shops OSM parsing — pure functions + tests

**Files:**
- Create: `apps/web/lib/nearby-shops.ts`
- Test: `apps/web/lib/nearby-shops.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/lib/nearby-shops.test.ts
import { describe, it, expect } from "vitest";
import { tileKey, toNearbyShop, buildOverpassQuery } from "./nearby-shops";

describe("tileKey", () => {
  it("rounds bounds to 2 decimal places so nearby pans share a key", () => {
    expect(tileKey(38.7051, -9.1401, 38.7099, -9.1349)).toBe(tileKey(38.7049, -9.1399, 38.7101, -9.1351));
  });

  it("produces different keys for distant boxes", () => {
    expect(tileKey(38.7, -9.1, 38.8, -9.0)).not.toBe(tileKey(40.7, -74.0, 40.8, -73.9));
  });
});

describe("buildOverpassQuery", () => {
  it("includes the bounding box and both node and way cafe queries", () => {
    const q = buildOverpassQuery({ minLat: 38.7, minLng: -9.2, maxLat: 38.8, maxLng: -9.1 });
    expect(q).toContain('node["amenity"="cafe"](38.7,-9.2,38.8,-9.1)');
    expect(q).toContain('way["amenity"="cafe"](38.7,-9.2,38.8,-9.1)');
  });
});

describe("toNearbyShop", () => {
  it("maps a node element with full tags", () => {
    const shop = toNearbyShop({
      type: "node",
      id: 123,
      lat: 38.71,
      lon: -9.14,
      tags: {
        name: "Corner Cafe",
        "addr:housenumber": "12",
        "addr:street": "Rua do Ouro",
        opening_hours: "Mo-Fr 08:00-18:00",
        website: "https://cornercafe.pt",
        phone: "+351 21 000 0000",
      },
    });
    expect(shop).toEqual({
      externalId: "node/123",
      name: "Corner Cafe",
      lat: 38.71,
      lng: -9.14,
      address: "12 Rua do Ouro",
      hours: "Mo-Fr 08:00-18:00",
      website: "https://cornercafe.pt",
      phone: "+351 21 000 0000",
    });
  });

  it("maps a way element using its center point", () => {
    const shop = toNearbyShop({
      type: "way",
      id: 456,
      center: { lat: 38.72, lon: -9.15 },
      tags: { name: "Bean & Leaf" },
    });
    expect(shop).toEqual({
      externalId: "way/456",
      name: "Bean & Leaf",
      lat: 38.72,
      lng: -9.15,
      address: null,
      hours: null,
      website: null,
      phone: null,
    });
  });

  it("returns null when there's no name", () => {
    expect(toNearbyShop({ type: "node", id: 1, lat: 1, lon: 1, tags: {} })).toBeNull();
  });

  it("returns null when there's no position", () => {
    expect(toNearbyShop({ type: "way", id: 1, tags: { name: "Ghost Cafe" } })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web test`
Expected: FAIL — `apps/web/lib/nearby-shops.ts` does not exist yet.

- [ ] **Step 3: Implement**

```typescript
// apps/web/lib/nearby-shops.ts

// The "any shop nearby" layer — live OpenStreetMap data via Overpass, never
// bulk-imported (see docs/superpowers/specs/2026-09-03-map-community-shops-
// design.md). These are pure, easily-testable pieces of the proxy endpoint
// in app/api/nearby-shops/route.ts.

export type OverpassElement = {
  type: "node" | "way";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type NearbyShop = {
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  hours: string | null;
  website: string | null;
  phone: string | null;
};

export type Bounds = { minLat: number; minLng: number; maxLat: number; maxLng: number };

// Rounds to ~0.01 degrees (~1km) so nearby pans/zooms share a cache entry
// instead of each pixel of movement missing the cache.
export function tileKey(minLat: number, minLng: number, maxLat: number, maxLng: number): string {
  const round = (n: number) => Math.round(n * 100) / 100;
  return `${round(minLat)},${round(minLng)},${round(maxLat)},${round(maxLng)}`;
}

export function buildOverpassQuery(bounds: Bounds): string {
  const { minLat, minLng, maxLat, maxLng } = bounds;
  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;
  return `[out:json][timeout:25];(node["amenity"="cafe"](${bbox});way["amenity"="cafe"](${bbox}););out center;`;
}

export function toNearbyShop(el: OverpassElement): NearbyShop | null {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  const name = el.tags?.name;
  if (lat === undefined || lng === undefined || !name) return null;

  const tags = el.tags ?? {};
  const addressParts = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean);

  return {
    externalId: `${el.type}/${el.id}`,
    name,
    lat,
    lng,
    address: addressParts.length ? addressParts.join(" ") : null,
    hours: tags["opening_hours"] ?? null,
    website: tags["website"] ?? tags["contact:website"] ?? null,
    phone: tags["phone"] ?? tags["contact:phone"] ?? null,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/nearby-shops.ts apps/web/lib/nearby-shops.test.ts
git commit -m "feat: add OSM nearby-shop parsing helpers"
```

---

### Task 12: Nearby-shops API route

**Files:**
- Create: `apps/web/app/api/nearby-shops/route.ts`

- [ ] **Step 1: Implement the route**

```typescript
// apps/web/app/api/nearby-shops/route.ts
import { NextResponse } from "next/server";
import { buildOverpassQuery, tileKey, toNearbyShop, type OverpassElement } from "@/lib/nearby-shops";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
// ponytail: in-memory, per-instance cache only — good enough at launch
// scale; move to a shared cache (Vercel KV/Upstash) if the public Overpass
// instance's fair-use limits become a real constraint (see spec's
// "Out of scope" section).
const CACHE_TTL_MS = 10 * 60 * 1000;

type CacheEntry = { expiresAt: number; body: { shops: ReturnType<typeof toNearbyShop>[] } };
const cache = new Map<string, CacheEntry>();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const minLat = Number(url.searchParams.get("minLat"));
  const minLng = Number(url.searchParams.get("minLng"));
  const maxLat = Number(url.searchParams.get("maxLat"));
  const maxLng = Number(url.searchParams.get("maxLng"));

  if ([minLat, minLng, maxLat, maxLng].some((n) => Number.isNaN(n))) {
    return NextResponse.json({ error: "minLat, minLng, maxLat, maxLng are required" }, { status: 400 });
  }

  const bounds = { minLat, minLng, maxLat, maxLng };
  const key = tileKey(minLat, minLng, maxLat, maxLng);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.body);
  }

  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    body: `data=${encodeURIComponent(buildOverpassQuery(bounds))}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Overpass request failed" }, { status: 502 });
  }

  const raw = (await response.json()) as { elements: OverpassElement[] };
  const shops = raw.elements.map(toNearbyShop).filter((s) => s !== null);
  const body = { shops };

  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, body });
  return NextResponse.json(body);
}
```

- [ ] **Step 2: Verify typecheck and a manual smoke test**

Run: `pnpm --filter web typecheck`
Expected: PASS

Run the dev server and hit the route directly:
```bash
pnpm --filter web dev &
sleep 3
curl "http://localhost:3000/api/nearby-shops?minLat=38.70&minLng=-9.20&maxLat=38.80&maxLng=-9.10"
```
Expected: JSON body `{"shops": [...]}` with real Lisbon-area cafes from OpenStreetMap (name/lat/lng at minimum). Stop the dev server afterward (`kill %1`).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/nearby-shops/route.ts
git commit -m "feat: add live OSM nearby-shops proxy endpoint"
```

---

## Self-Review Notes

- **Spec coverage:** data source/proxy (Task 11-12), schema split (Task 2-3), promotion pipeline (Task 7), map query source (Task 8, 10), lazy shop creation for logging (Task 9-10). City-guides consumer fix (Task 4-5) wasn't explicitly named in the spec but is a required consequence of the schema split — without it, city guides break.
- **Not covered here (by design, per the plan's scope note):** the map screen UI itself (separate plan), the admin Candidates queue (blocked on a mockup).
