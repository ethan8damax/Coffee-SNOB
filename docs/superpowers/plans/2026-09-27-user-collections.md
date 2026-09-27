# User Collections, Faves and Top 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** People build public or private collections of any café, save others' collections, show Faves (saved shops + collections) if they choose, and hand-pick a Top 4 on their profile.

**Architecture:** One migration extends the existing `lists` / `list_items` / `list_saves` / `shop_saves` tables with ownership, visibility and RLS, and adds `profile_top_shops` plus an `ensure_shop` RPC. Typed query functions in `packages/supabase` wrap them. The Expo app gets a collection page, an add-to-collection sheet, reworked profile tabs, a Top 4 row with a picker, and a Settings switch.

**Tech Stack:** Supabase Postgres (RLS, plpgsql), PGlite for SQL tests, TypeScript, Expo Router + react-native-web, Vitest.

Spec: `docs/superpowers/specs/2026-09-27-user-collections-design.md`.

---

## File map

| File | Responsibility |
| --- | --- |
| `supabase/migrations/0034_user_collections.sql` | Schema, RLS, triggers, `ensure_shop` |
| `packages/supabase/test/collections-sql.test.ts` | PGlite: RLS and trigger behaviour |
| `packages/supabase/src/types.ts` | Hand-patched table / RPC types |
| `packages/supabase/src/collections.ts` | Collection, Faves, Top 4, `ensureShop` queries (new file: queries.ts is 1,300+ lines) |
| `packages/supabase/test/collections.test.ts` | Query mapping tests |
| `packages/supabase/src/index.ts` | Exports |
| `apps/app/lib/collections/top4.ts` (+ test) | Pure slot layout helper |
| `apps/app/lib/collections/use-collections.ts` | Hooks (framework glue) |
| `apps/app/components/collections/add-to-collection.tsx` | The sheet |
| `apps/app/components/collections/collection-view.tsx` | Collection page body |
| `apps/app/app/(tabs)/collection/[id].tsx` | Route |
| `apps/app/components/profile/top-four.tsx` | Top 4 row + picker |
| `apps/app/components/profile/profile-view.tsx` | Tabs: Entries · Collections · Faves |
| `apps/app/components/profile/status-block.tsx` | Swap Top shops for Top 4 |
| `apps/app/app/(tabs)/settings.tsx` | Faves visibility switch |
| `apps/app/components/shop/parts.tsx`, `components/map/preview-card.tsx`, `app/(tabs)/map.tsx` | "Add to collection" entry points |
| `apps/app/components/feed/collection-card.tsx` | Opens the collection page |

---

### Task 1: Migration 0033 with PGlite tests

**Files:**
- Create: `supabase/migrations/0034_user_collections.sql`
- Test: `packages/supabase/test/collections-sql.test.ts`

- [ ] **Step 1: Write the failing test.** Stand-in schema mirrors the real columns; `auth.uid()` reads a session setting so tests can switch users; statements run as role `authenticated` so RLS applies.

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

const MIGRATION = readFileSync(join(__dirname, "../../../supabase/migrations/0034_user_collections.sql"), "utf8");
const SCHEMA = `
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create role anon; create role authenticated;
  create table auth.users (id uuid primary key);
  create table public.profiles (id uuid primary key, is_admin boolean not null default false, status text not null default 'active');
  create function public.is_admin() returns boolean language sql stable as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;
  create function public.is_active() returns boolean language sql stable as $$ select coalesce((select status = 'active' from public.profiles where id = auth.uid()), false) $$;
  create function public.is_chain_name(p text) returns boolean language sql as $$ select p ilike 'starbucks%' $$;
  create table public.cities (id uuid primary key);
  create table public.shops (
    id uuid primary key default gen_random_uuid(), external_id text unique, name text not null, lat float8, lng float8,
    address text, website text, phone text, hours text, locality text, region text, country_code text
  );
  create table public.logs (id uuid primary key default gen_random_uuid(), shop_id uuid references public.shops (id));
  create table public.lists (
    id uuid primary key default gen_random_uuid(), type text not null check (type in ('city_guide', 'collection')),
    slug text unique not null, title text not null, description text, body text, city_id uuid references public.cities (id),
    curator_id uuid references auth.users (id), cover_photo_alt text, save_count integer not null default 0,
    created_at timestamptz not null default now()
  );
  create table public.list_items (
    id uuid primary key default gen_random_uuid(), list_id uuid not null references public.lists (id) on delete cascade,
    shop_id uuid not null references public.shops (id) on delete cascade, position integer not null, note text, unique (list_id, shop_id)
  );
  create table public.list_saves (user_id uuid not null references auth.users (id), list_id uuid not null references public.lists (id) on delete cascade,
    created_at timestamptz not null default now(), primary key (user_id, list_id));
  create table public.shop_saves (user_id uuid not null references auth.users (id), shop_id uuid not null references public.shops (id),
    created_at timestamptz not null default now(), primary key (user_id, shop_id));
  alter table public.lists enable row level security;
  alter table public.list_items enable row level security;
  alter table public.list_saves enable row level security;
  alter table public.shop_saves enable row level security;
  alter table public.profiles enable row level security;
  create policy "profiles are publicly readable" on public.profiles for select using (true);
  create policy "users update their own profile" on public.profiles for update using (auth.uid() = id);
  create policy "lists are publicly readable" on public.lists for select using (true);
  create policy "list_items are publicly readable" on public.list_items for select using (true);
  create policy "admins insert lists" on public.lists for insert with check (public.is_admin());
  create policy "users manage their own saves" on public.list_saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy "users manage their own shop saves" on public.shop_saves for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create function public.handle_list_save_change() returns trigger language plpgsql set search_path = public as $$
  begin
    if tg_op = 'INSERT' then update public.lists set save_count = save_count + 1 where id = new.list_id; return new;
    else update public.lists set save_count = greatest(save_count - 1, 0) where id = old.list_id; return old; end if;
  end $$;
  create trigger on_list_save_change after insert or delete on public.list_saves for each row execute function public.handle_list_save_change();
  grant usage on schema public to authenticated, anon;
  grant all on all tables in schema public to authenticated, anon;
`;

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [ANA, BO] = [uuid(1), uuid(2)];
let db: PGlite;

async function as<T>(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`set test.uid = '${user ?? ""}'; set role ${user ? "authenticated" : "anon"};`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role;");
  }
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(MIGRATION);
  for (const u of [ANA, BO]) {
    await db.query("insert into auth.users (id) values ($1)", [u]);
    await db.query("insert into public.profiles (id) values ($1)", [u]);
  }
  await db.query("insert into public.shops (id, name) values ($1, 'Perc'), ($2, 'Spiller Park')", [uuid(100), uuid(101)]);
});

const newList = (user: string, title: string, isPublic = false) =>
  as<{ id: string; slug: string }>(user, "insert into public.lists (type, title, is_public, curator_id) values ('collection', $1, $2, $3) returning id, slug", [title, isPublic, user]);

describe("user collections", () => {
  it("creates a private collection with a generated slug, hidden from everyone else", async () => {
    const [list] = await newList(ANA, "Boston wishlist");
    expect(list.slug).toMatch(/^boston-wishlist-[0-9a-f]{6}$/);
    expect(await as(BO, "select id from public.lists")).toEqual([]);
    expect(await as(null, "select id from public.lists")).toEqual([]);
    expect(await as(ANA, "select id from public.lists")).toHaveLength(1);
  });

  it("shows a public collection and its items to anyone; only the owner edits", async () => {
    const [list] = await newList(ANA, "London", true);
    await as(ANA, "insert into public.list_items (list_id, shop_id) values ($1, $2)", [list.id, uuid(100)]);
    expect(await as(null, "select shop_id, position from public.list_items")).toEqual([{ shop_id: uuid(100), position: 1 }]);
    await as(BO, "update public.lists set title = 'mine now' where id = $1", [list.id]);
    await expect(as(BO, "insert into public.list_items (list_id, shop_id) values ($1, $2)", [list.id, uuid(101)])).rejects.toThrow();
    expect((await as<{ title: string }>(ANA, "select title from public.lists"))[0].title).toBe("London");
  });

  it("hides a private collection's items too", async () => {
    const [list] = await newList(ANA, "Secret");
    await as(ANA, "insert into public.list_items (list_id, shop_id) values ($1, $2)", [list.id, uuid(100)]);
    expect(await as(BO, "select * from public.list_items")).toEqual([]);
  });

  it("won't let an owner fake a save count, but real saves count", async () => {
    const [list] = await newList(ANA, "London", true);
    await as(ANA, "update public.lists set save_count = 999 where id = $1", [list.id]);
    await as(BO, "insert into public.list_saves (user_id, list_id) values ($1, $2)", [BO, list.id]);
    expect((await as<{ save_count: number }>(ANA, "select save_count from public.lists"))[0].save_count).toBe(1);
  });

  it("can't save a private collection you can't see", async () => {
    const [list] = await newList(ANA, "Secret");
    await expect(as(BO, "insert into public.list_saves (user_id, list_id) values ($1, $2)", [BO, list.id])).rejects.toThrow();
  });

  it("caps a collection at 200 cafés", async () => {
    const [list] = await newList(ANA, "Big");
    await db.query("insert into public.shops (name) select 'S' || g from generate_series(1, 201) g");
    await db.query("insert into public.list_items (list_id, shop_id, position) select $1, id, row_number() over () from public.shops where name like 'S%' limit 200", [list.id]);
    const [extra] = await db.query<{ id: string }>("select id from public.shops where name like 'S%' and id not in (select shop_id from public.list_items)").then((r) => r.rows);
    await expect(as(ANA, "insert into public.list_items (list_id, shop_id) values ($1, $2)", [list.id, extra.id])).rejects.toThrow(/200/);
  });

  it("shows Faves to others only when the owner makes them public", async () => {
    const [list] = await newList(ANA, "London", true);
    await as(BO, "insert into public.list_saves (user_id, list_id) values ($1, $2)", [BO, list.id]);
    await as(BO, "insert into public.shop_saves (user_id, shop_id) values ($1, $2)", [BO, uuid(100)]);
    expect(await as(ANA, "select * from public.shop_saves")).toEqual([]);
    expect(await as(ANA, "select * from public.list_saves")).toEqual([]);
    await as(BO, "update public.profiles set faves_public = true where id = $1", [BO]);
    expect(await as(null, "select shop_id from public.shop_saves")).toEqual([{ shop_id: uuid(100) }]);
    expect(await as(null, "select list_id from public.list_saves")).toEqual([{ list_id: list.id }]);
  });

  it("keeps Top 4 to four slots, one shop once, owner-only writes", async () => {
    await as(ANA, "insert into public.profile_top_shops (user_id, slot, shop_id) values ($1, 3, $2)", [ANA, uuid(100)]);
    await expect(as(ANA, "insert into public.profile_top_shops (user_id, slot, shop_id) values ($1, 5, $2)", [ANA, uuid(101)])).rejects.toThrow();
    await expect(as(ANA, "insert into public.profile_top_shops (user_id, slot, shop_id) values ($1, 1, $2)", [ANA, uuid(100)])).rejects.toThrow();
    await expect(as(BO, "insert into public.profile_top_shops (user_id, slot, shop_id) values ($1, 1, $2)", [ANA, uuid(101)])).rejects.toThrow();
    expect(await as(null, "select slot from public.profile_top_shops")).toEqual([{ slot: 3 }]);
  });

  it("ensure_shop creates or finds a shop without logging, and refuses chains", async () => {
    const [{ ensure_shop: id }] = await as<{ ensure_shop: string }>(ANA, "select public.ensure_shop('cs_aaaaaaaaaaaa', 'Chrome Yellow', 33.7, -84.3)");
    const [{ ensure_shop: again }] = await as<{ ensure_shop: string }>(ANA, "select public.ensure_shop('cs_aaaaaaaaaaaa', 'Chrome Yellow', 33.7, -84.3)");
    expect(again).toBe(id);
    expect((await db.query("select * from public.logs")).rows).toEqual([]);
    await expect(as(ANA, "select public.ensure_shop('cs_bbbbbbbbbbbb', 'Starbucks', 1, 1)")).rejects.toThrow(/chain/);
    await expect(as(null, "select public.ensure_shop('cs_cccccccccccc', 'X', 1, 1)")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`ENOENT` for the migration file).

Run: `cd packages/supabase && npx vitest run test/collections-sql.test.ts`

- [ ] **Step 3: Write the migration.**

```sql
-- User collections, Faves and Top 4
-- (docs/superpowers/specs/2026-09-27-user-collections-design.md).

-- ── Collections: the existing lists table, owned and public or private ──
alter table public.lists add column is_public boolean not null default false;
update public.lists set is_public = true where type = 'city_guide' or curator_id is null;

drop policy "lists are publicly readable" on public.lists;
create policy "lists readable when public or yours" on public.lists for select
  using (type = 'city_guide' or is_public or curator_id = (select auth.uid()));
create policy "users create their own collections" on public.lists for insert
  with check (type = 'collection' and curator_id = (select auth.uid()));
create policy "users edit their own collections" on public.lists for update
  using (type = 'collection' and curator_id = (select auth.uid()))
  with check (type = 'collection' and curator_id = (select auth.uid()));
create policy "users delete their own collections" on public.lists for delete
  using (type = 'collection' and curator_id = (select auth.uid()));
create policy "must be active to insert" on public.lists as restrictive for insert with check (public.is_active());

-- Slugs are generated; users never see or set them. Owners can't touch the
-- save count, type, slug or owner. pg_trigger_depth() = 1 is a direct write;
-- the save-count trigger's own update runs deeper and passes through.
create or replace function public.guard_list_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.slug is null then
      new.slug := coalesce(nullif(trim(both '-' from regexp_replace(lower(new.title), '[^a-z0-9]+', '-', 'g')), ''), 'collection')
        || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
    end if;
    if not public.is_admin() then new.save_count := 0; end if;
  elsif pg_trigger_depth() = 1 and not public.is_admin() then
    new.save_count := old.save_count;
    new.type := old.type;
    new.slug := old.slug;
    new.curator_id := old.curator_id;
    new.city_id := old.city_id;
  end if;
  return new;
end;
$$;
-- NOT NULL is checked after BEFORE triggers, so the generated slug satisfies it.
create trigger guard_list_write before insert or update on public.lists
  for each row execute function public.guard_list_write();

-- Items follow their list: readable when the list is (the subquery runs
-- under the lists policy), written by the list's owner.
drop policy "list_items are publicly readable" on public.list_items;
create policy "list items readable with their list" on public.list_items for select
  using (exists (select 1 from public.lists l where l.id = list_id));
create policy "owners add to their collections" on public.list_items for insert
  with check (exists (select 1 from public.lists l where l.id = list_id and l.type = 'collection' and l.curator_id = (select auth.uid())));
create policy "owners edit their collections" on public.list_items for update
  using (exists (select 1 from public.lists l where l.id = list_id and l.type = 'collection' and l.curator_id = (select auth.uid())));
create policy "owners remove from their collections" on public.list_items for delete
  using (exists (select 1 from public.lists l where l.id = list_id and l.type = 'collection' and l.curator_id = (select auth.uid())));
create policy "must be active to insert" on public.list_items as restrictive for insert with check (public.is_active());

-- New items go to the end; a collection holds at most 200 cafés.
create or replace function public.place_list_item()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*), coalesce(max(position), 0) + 1 into v_count, new.position
  from public.list_items where list_id = new.list_id;
  if v_count >= 200 then
    raise exception 'a collection holds at most 200 cafés';
  end if;
  return new;
end;
$$;
create trigger place_list_item before insert on public.list_items
  for each row when (new.position is null) execute function public.place_list_item();
create or replace function public.cap_list_items()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.list_items where list_id = new.list_id) >= 200 then
    raise exception 'a collection holds at most 200 cafés';
  end if;
  return new;
end;
$$;
create trigger cap_list_items before insert on public.list_items
  for each row when (new.position is not null) execute function public.cap_list_items();

-- Save counts: the trigger now runs as its owner, so a saver (who can't
-- update someone else's list) still moves the count.
alter function public.handle_list_save_change() security definer;
revoke all on function public.handle_list_save_change() from public, anon, authenticated;

-- ── Faves: saved shops and collections, public if the owner says so ────
alter table public.profiles add column faves_public boolean not null default false;

create policy "saves readable when faves are public" on public.list_saves for select
  using (exists (select 1 from public.profiles p where p.id = user_id and p.faves_public));
-- You can only save what you can see.
create policy "only readable lists can be saved" on public.list_saves as restrictive for insert
  with check (exists (select 1 from public.lists l where l.id = list_id));
create policy "shop saves readable when faves are public" on public.shop_saves for select to anon, authenticated
  using (exists (select 1 from public.profiles p where p.id = user_id and p.faves_public));

-- ── Top 4 ──────────────────────────────────────────────────────────────
create table public.profile_top_shops (
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot smallint not null check (slot between 1 and 4),
  shop_id uuid not null references public.shops (id) on delete cascade,
  primary key (user_id, slot),
  unique (user_id, shop_id)
);
create index profile_top_shops_shop_idx on public.profile_top_shops (shop_id);
alter table public.profile_top_shops enable row level security;
create policy "top shops are publicly readable" on public.profile_top_shops for select using (true);
create policy "users pick their own top shops" on public.profile_top_shops for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── ensure_shop: the shop half of log_shop_visit, with no log ──────────
create or replace function public.ensure_shop(
  p_external_id text,
  p_name text,
  p_lat double precision,
  p_lng double precision,
  p_address text default null,
  p_website text default null,
  p_phone text default null,
  p_hours text default null,
  p_locality text default null,
  p_region text default null,
  p_country_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
  v_website text := nullif(btrim(p_website), '');
begin
  if auth.uid() is null then raise exception 'must be signed in'; end if;
  if not public.is_active() then raise exception 'account is suspended'; end if;
  if public.is_chain_name(p_name) then raise exception 'chain shops can''t be added'; end if;
  if v_website is not null and v_website !~* '^https?://' then v_website := null; end if;

  insert into public.shops (external_id, name, lat, lng, address, website, phone, hours, locality, region, country_code)
  values (
    p_external_id, left(p_name, 200), p_lat, p_lng,
    left(nullif(btrim(p_address), ''), 300), left(v_website, 500), left(nullif(btrim(p_phone), ''), 50),
    left(nullif(btrim(p_hours), ''), 500), left(nullif(btrim(p_locality), ''), 100), left(nullif(btrim(p_region), ''), 100),
    upper(left(nullif(btrim(p_country_code), ''), 2))
  )
  on conflict (external_id) do update set name = shops.name
  returning id into v_shop_id;
  return v_shop_id;
end;
$$;
revoke all on function public.ensure_shop(text, text, double precision, double precision, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ensure_shop(text, text, double precision, double precision, text, text, text, text, text, text, text) to authenticated;
```

Note for production: `shops.external_id`'s unique index is partial (`where external_id is not null`), so the real migration's `on conflict` must read `on conflict (external_id) where external_id is not null` (as in 0026). The PGlite stand-in uses a plain unique column; use the partial form in the file and give the stand-in `create unique index ... where external_id is not null` instead of `unique` so both agree.

- [ ] **Step 4: Run — expect PASS.** Fix and re-run until green.

- [ ] **Step 5: Commit** — `git add supabase/migrations/0034_user_collections.sql packages/supabase/test/collections-sql.test.ts && git commit -m "Collections: migration 0033 with RLS tests"`

### Task 2: Apply to production, advisors, types

- [ ] Check production policy names match the stand-in (`select policyname, tablename from pg_policies where tablename in ('lists','list_items','list_saves','shop_saves')`). Adjust `drop policy` names if needed.
- [ ] Apply via Supabase MCP `apply_migration` (name `0034_user_collections`). Run security + performance advisors; nothing new for these objects.
- [ ] Patch `packages/supabase/src/types.ts`: `lists.is_public` (Row/Insert/Update, `slug` optional on Insert), `profiles.faves_public`, `profile_top_shops` table with FKs to profiles and shops, `ensure_shop` in `Functions` (Args as the SQL signature, optional `p_address…p_country_code`, Returns `string`).
- [ ] `npx tsc --noEmit -p packages/supabase`; commit.

### Task 3: Queries (`packages/supabase/src/collections.ts`)

**Files:** create `packages/supabase/src/collections.ts`, `packages/supabase/test/collections.test.ts`; modify `packages/supabase/src/index.ts`, `packages/supabase/src/queries.ts` (`PublicProfile` gains `favesPublic`; `getProfileFaves` removed once unused).

- [ ] **Step 1: Failing tests** (same mock style as `queries.test.ts`):

```ts
import { describe, expect, it, vi } from "vitest";
import { addToCollection, ensureShop, getTopShops, toCollectionSummary } from "../src/collections";

describe("collections queries", () => {
  it("maps a list row with its item count", () => {
    expect(toCollectionSummary({ id: "l1", title: "London", description: null, is_public: true, save_count: 3, curator_id: "u1", created_at: "t", list_items: [{ count: 7 }] }))
      .toEqual({ id: "l1", title: "London", description: null, isPublic: true, saveCount: 3, ownerId: "u1", shopCount: 7, createdAt: "t" });
  });

  it("adds a shop and ignores it if it's already there", async () => {
    const upsert = vi.fn(() => Promise.resolve({ error: null }));
    await addToCollection({ from: () => ({ upsert }) } as any, "l1", "s1");
    expect(upsert).toHaveBeenCalledWith({ list_id: "l1", shop_id: "s1" }, { onConflict: "list_id,shop_id", ignoreDuplicates: true });
  });

  it("ensureShop sends the place and returns the shop id", async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: "shop-1", error: null }));
    expect(await ensureShop({ rpc } as any, { externalId: "cs_aaaaaaaaaaaa", name: "Perc", lat: 1, lng: 2, address: "12 Main" })).toBe("shop-1");
    expect(rpc).toHaveBeenCalledWith("ensure_shop", expect.objectContaining({ p_external_id: "cs_aaaaaaaaaaaa", p_name: "Perc", p_lat: 1, p_lng: 2, p_address: "12 Main" }));
  });

  it("getTopShops returns filled slots in slot order", async () => {
    const rows = [{ slot: 3, shop_id: "s3", shops: { name: "C" } }, { slot: 1, shop_id: "s1", shops: { name: "A" } }];
    const order = vi.fn(() => Promise.resolve({ data: rows, error: null }));
    const client = { from: () => ({ select: () => ({ eq: () => ({ order }) }) }) } as any;
    expect(await getTopShops(client, "u1")).toEqual([{ slot: 3, shopId: "s3", name: "C" }, { slot: 1, shopId: "s1", name: "A" }]);
  });
});
```

- [ ] **Step 2: Run — FAIL** (module missing).

- [ ] **Step 3: Implement** `collections.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

type Client = SupabaseClient<Database>;

export type CollectionSummary = {
  id: string; title: string; description: string | null; isPublic: boolean; saveCount: number;
  ownerId: string | null; shopCount: number; createdAt: string;
};
export type CollectionItem = { shopId: string; name: string; neighborhood: string | null; locality: string | null; note: string | null; lat: number | null; lng: number | null; rated: boolean };
export type Collection = CollectionSummary & { ownerUsername: string | null; items: CollectionItem[] };
export type TopShop = { slot: number; shopId: string; name: string };

const SUMMARY = "id, title, description, is_public, save_count, curator_id, created_at, list_items(count)";

export function toCollectionSummary(r: {
  id: string; title: string; description: string | null; is_public: boolean; save_count: number;
  curator_id: string | null; created_at: string; list_items: { count: number }[];
}): CollectionSummary {
  return {
    id: r.id, title: r.title, description: r.description, isPublic: r.is_public, saveCount: r.save_count,
    ownerId: r.curator_id, shopCount: r.list_items[0]?.count ?? 0, createdAt: r.created_at,
  };
}

// A person's collections. RLS hides private ones from everyone but them.
export async function getUserCollections(client: Client, userId: string): Promise<CollectionSummary[]> {
  const { data, error } = await client.from("lists").select(SUMMARY).eq("type", "collection").eq("curator_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(toCollectionSummary);
}

export async function getCollection(client: Client, id: string): Promise<Collection | null> {
  const { data, error } = await client
    .from("lists")
    .select(`${SUMMARY}, profiles:curator_id(username), items:list_items(shop_id, note, position, shops(name, neighborhood, locality, lat, lng))`)
    .eq("id", id)
    .eq("type", "collection")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const items = [...data.items].sort((a, b) => a.position - b.position);
  const shopIds = items.map((i) => i.shop_id);
  // Rated = logged at least once; unrated cafés open on the map instead of a shop page.
  const { data: rated, error: ratedError } = shopIds.length
    ? await client.from("shop_ratings").select("id").in("id", shopIds)
    : { data: [], error: null };
  if (ratedError) throw ratedError;
  const ratedIds = new Set((rated ?? []).map((r) => r.id));
  return {
    ...toCollectionSummary({ ...data, list_items: [{ count: items.length }] }),
    ownerUsername: (data.profiles as { username: string } | null)?.username ?? null,
    items: items.map((i) => ({
      shopId: i.shop_id, note: i.note, name: i.shops?.name ?? "", neighborhood: i.shops?.neighborhood ?? null,
      locality: i.shops?.locality ?? null, lat: i.shops?.lat ?? null, lng: i.shops?.lng ?? null, rated: ratedIds.has(i.shop_id),
    })),
  };
}

export async function createCollection(client: Client, userId: string, fields: { title: string; isPublic: boolean; description?: string | null }): Promise<string> {
  const { data, error } = await client
    .from("lists")
    .insert({ type: "collection", curator_id: userId, title: fields.title.trim().slice(0, 120), is_public: fields.isPublic, description: fields.description?.trim() || null })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateCollection(client: Client, id: string, fields: { title?: string; description?: string | null; isPublic?: boolean }): Promise<void> {
  const update: { title?: string; description?: string | null; is_public?: boolean } = {};
  if (fields.title !== undefined) update.title = fields.title.trim().slice(0, 120);
  if (fields.description !== undefined) update.description = fields.description?.trim() || null;
  if (fields.isPublic !== undefined) update.is_public = fields.isPublic;
  const { error } = await client.from("lists").update(update).eq("id", id);
  if (error) throw error;
}

export async function deleteCollection(client: Client, id: string): Promise<void> {
  const { error } = await client.from("lists").delete().eq("id", id);
  if (error) throw error;
}

export async function addToCollection(client: Client, listId: string, shopId: string): Promise<void> {
  const { error } = await client.from("list_items").upsert({ list_id: listId, shop_id: shopId }, { onConflict: "list_id,shop_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeFromCollection(client: Client, listId: string, shopId: string): Promise<void> {
  const { error } = await client.from("list_items").delete().eq("list_id", listId).eq("shop_id", shopId);
  if (error) throw error;
}

export async function setCollectionNote(client: Client, listId: string, shopId: string, note: string | null): Promise<void> {
  const { error } = await client.from("list_items").update({ note: note?.trim().slice(0, 300) || null }).eq("list_id", listId).eq("shop_id", shopId);
  if (error) throw error;
}

// Which of my collections already hold this shop (for the sheet's checks).
export async function getCollectionsWithShop(client: Client, userId: string, shopId: string): Promise<string[]> {
  const { data, error } = await client.from("list_items").select("list_id, lists!inner(curator_id)").eq("shop_id", shopId).eq("lists.curator_id", userId);
  if (error) throw error;
  return data.map((r) => r.list_id);
}

// ── Saving collections (Faves) ──
export async function isCollectionSaved(client: Client, userId: string, listId: string): Promise<boolean> {
  const { data, error } = await client.from("list_saves").select("list_id").eq("user_id", userId).eq("list_id", listId).maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function setCollectionSaved(client: Client, userId: string, listId: string, saved: boolean): Promise<void> {
  const { error } = saved
    ? await client.from("list_saves").upsert({ user_id: userId, list_id: listId }, { onConflict: "user_id,list_id", ignoreDuplicates: true })
    : await client.from("list_saves").delete().eq("user_id", userId).eq("list_id", listId);
  if (error) throw error;
}

// RLS returns these only to the owner, or to anyone when their Faves are public.
export async function getSavedCollections(client: Client, userId: string): Promise<CollectionSummary[]> {
  const { data, error } = await client.from("list_saves").select(`created_at, lists(${SUMMARY})`).eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data.flatMap((r) => (r.lists ? [toCollectionSummary(r.lists)] : []));
}

export async function setFavesPublic(client: Client, userId: string, isPublic: boolean): Promise<void> {
  const { error } = await client.from("profiles").update({ faves_public: isPublic }).eq("id", userId);
  if (error) throw error;
}

// ── Top 4 ──
export async function getTopShops(client: Client, userId: string): Promise<TopShop[]> {
  const { data, error } = await client.from("profile_top_shops").select("slot, shop_id, shops(name)").eq("user_id", userId).order("slot");
  if (error) throw error;
  return data.map((r) => ({ slot: r.slot, shopId: r.shop_id, name: r.shops?.name ?? "" }));
}

// Putting a shop in a slot moves it there if it was in another slot.
export async function setTopShop(client: Client, userId: string, slot: number, shopId: string): Promise<void> {
  const del = await client.from("profile_top_shops").delete().eq("user_id", userId).or(`slot.eq.${slot},shop_id.eq.${shopId}`);
  if (del.error) throw del.error;
  const { error } = await client.from("profile_top_shops").insert({ user_id: userId, slot, shop_id: shopId });
  if (error) throw error;
}

export async function clearTopShop(client: Client, userId: string, slot: number): Promise<void> {
  const { error } = await client.from("profile_top_shops").delete().eq("user_id", userId).eq("slot", slot);
  if (error) throw error;
}

// ── Unrated cafés ──
export type PlaceRef = {
  externalId: string; name: string; lat: number; lng: number; address?: string | null; website?: string | null;
  phone?: string | null; hours?: string | null; locality?: string | null; region?: string | null; countryCode?: string | null;
  legacyIds?: string[];
};

// The shop row for a map café, created (unrated) if nobody has logged it yet.
// Older shops keep their OSM id, so those are checked first, as in logVisit.
export async function ensureShop(client: Client, p: PlaceRef): Promise<string> {
  if (p.legacyIds?.length) {
    const { data, error } = await client.from("shops").select("id").in("external_id", p.legacyIds).limit(1);
    if (error) throw error;
    if (data?.[0]) return data[0].id;
  }
  const { data, error } = await client.rpc("ensure_shop", {
    p_external_id: p.externalId, p_name: p.name, p_lat: p.lat, p_lng: p.lng,
    p_address: p.address ?? undefined, p_website: p.website ?? undefined, p_phone: p.phone ?? undefined, p_hours: p.hours ?? undefined,
    p_locality: p.locality ?? undefined, p_region: p.region ?? undefined, p_country_code: p.countryCode ?? undefined,
  });
  if (error) throw error;
  return data as string;
}
```

Export everything from `src/index.ts` (`export * from "./collections";`). `getSavedShops`'s comment changes to "yours, or anyone's when their Faves are public". Add `favesPublic` to `PublicProfile` (select `faves_public`).

- [ ] **Step 4: Run tests — PASS**; `npx tsc --noEmit -p packages/supabase`.
- [ ] **Step 5: Commit.**

### Task 4: Top 4 slot helper (app)

**Files:** create `apps/app/lib/collections/top4.ts`, `apps/app/lib/collections/top4.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from "vitest";
import { topFourSlots } from "./top4";

describe("topFourSlots", () => {
  const picks = [{ slot: 3, shopId: "c", name: "C" }, { slot: 1, shopId: "a", name: "A" }];
  it("lays out four slots for the owner, empty ones as null", () => {
    expect(topFourSlots(picks, true).map((s) => s.pick?.shopId ?? null)).toEqual(["a", null, "c", null]);
  });
  it("shows visitors only the filled slots, in slot order", () => {
    expect(topFourSlots(picks, false).map((s) => s.slot)).toEqual([1, 3]);
  });
});
```

- [ ] **Step 2: Run — FAIL.** `cd apps/app && npx vitest run lib/collections/top4.test.ts`
- [ ] **Step 3: Implement**

```ts
import type { TopShop } from "@coffeesnob/supabase";

export type Slot = { slot: number; pick: TopShop | null };

// Four fixed slots, Letterboxd-style. Owners see the empty ones (to fill);
// visitors see only what's been picked.
export function topFourSlots(picks: TopShop[], isOwn: boolean): Slot[] {
  const all = [1, 2, 3, 4].map((slot) => ({ slot, pick: picks.find((p) => p.slot === slot) ?? null }));
  return isOwn ? all : all.filter((s) => s.pick);
}
```

- [ ] **Step 4: PASS. Step 5: Commit.**

### Task 5: Hooks

**File:** create `apps/app/lib/collections/use-collections.ts` — framework glue like `lib/profile/use-extras.ts` (reuse its `useLoad` by exporting it from there). Hooks: `useUserCollections(userId)`, `useCollection(id)`, `useSavedCollections(userId, enabled)`, `useTopShops(userId)` (replaces the old one in use-extras), `useCollectionSaved(userId, listId)` (optimistic toggle, same shape as `useShopSaved`). No unit tests (glue), typecheck only. Commit.

### Task 6: Add-to-collection sheet + entry points

**Files:** create `apps/app/components/collections/add-to-collection.tsx`; modify `components/shop/parts.tsx` (`Actions`), `components/map/preview-card.tsx` (unrated card + rated card), `app/(tabs)/map.tsx` (passes a `PlaceRef` for unrated rows).

Component contract:

```tsx
export function AddToCollection({ target, onClose }: {
  // A shop row, or a map café that may not have one yet.
  target: { shopId: string; name: string } | { place: PlaceRef; name: string };
  onClose: () => void;
})
```

Behaviour: a `Modal` (transparent, bottom sheet on phone, centred 420px card on desktop). Loads `getUserCollections(me)` and, for a shop target, `getCollectionsWithShop`. Each row: title, "Private"/"Public" label, a check when it holds the café; tapping toggles `addToCollection`/`removeFromCollection` (resolving `ensureShop(place)` once, first, for a place target). Footer: **New collection** reveals a name field + Public switch (default off) + **Create and add**. Errors show "Couldn't save that. Try again." inline. Signed out: button routes to `/sign-in` instead of opening.

Entry points: the shop page's `Actions` gets `ButtonLine title="Add to collection"`. The unrated preview card gets a third `ActionButton` titled **"Collect"** (short enough for three buttons in 360px). The rated preview card keeps its layout; its shop page has the button.

Verify on the web build (phone + desktop width) — open a shop, add to a new collection, confirm the check appears. Commit.

### Task 7: Collection page

**Files:** create `apps/app/app/(tabs)/collection/[id].tsx` and `apps/app/components/collections/collection-view.tsx`; register `collection/[id]` in `app/(tabs)/_layout.tsx` with `href: null`.

Layout (matches the shop page's back button + max width 640):
- Back; title (`D2`); "by @username" link; description; for the owner a `Private`/`Public` chip; `N cafés · saved by N`.
- Visitors: **Save** / **Saved** (`useCollectionSaved`). Owner: **Edit** toggles edit mode.
- Items: name (`Body` bold), area (`locality`/`neighborhood`), note (`BodySm`, ink2). Tap: rated → `/shop/[id]`; unrated → `/map` with `lat`/`lng` params (map flies there; add `lat`/`lng` param handling next to `add` in map.tsx).
- Edit mode: title and description inputs, Public switch, per item **Note** (inline input, save on blur) and **Remove**, and **Delete collection** (confirm via a second tap: "Tap again to delete").
- Not found / private: "This collection is private or gone."
Verify and commit.

### Task 8: Profile tabs

**File:** modify `apps/app/components/profile/profile-view.tsx`.

- `type Tab = "Entries" | "Collections" | "Faves"`. Tabs: own → all three; visitor → Entries, Collections, plus Faves only when `profile.favesPublic`.
- `CollectionsTab`: own profile starts with **New collection** (opens the create form from Task 6 without a target — `AddToCollection` gains an optional target; with none it's just the create form, then routes to the new collection). Rows: title, `N cafés`, Private chip for own private ones; tap opens the page. Empty: own "Make a list: a trip, a wishlist, your regulars." / visitor "No public collections yet."
- `FavesTab` (rewritten): **Collections** section (saved collections, with owner) then **Shops** section (saved shops, today's rows). Own profile header line: "Only you can see this." or "Anyone can see this." + "Change in Settings" link. Empty: own "Nothing saved. Save shops and collections to keep them here." / visitor "Nothing saved yet."
- Remove the old verdict-grid Faves and `useFaves`; remove `getProfileFaves` if nothing else imports it (`grep -rn getProfileFaves`).
Verify, commit.

### Task 9: Top 4

**Files:** create `apps/app/components/profile/top-four.tsx`; modify `components/profile/status-block.tsx` (replace `TopShopsRow` with `<TopFour userId isOwn />`; `StatusBlock` gains `isOwn`, passed from profile-view).

- Label **Top 4**. Tiles 72×88 as today (`tileGround(index)` colours, name in cream). Empty own slot: dashed `rule` border, `+` centred, accessibilityLabel "Pick a favourite shop for slot N".
- Tap empty slot → picker modal: search field + the owner's logged shops (distinct shops from `getProfileEntries`, up to 200, filtered by name), tap to `setTopShop`. Tap a filled own slot → small menu: **Replace** (opens picker) / **Remove** (`clearTopShop`). Visitors: tiles link to the shop page.
- Visitor with no picks: row hidden (the status row then shows the heatmap alone).
Verify, commit.

### Task 10: Settings switch

**File:** `apps/app/app/(tabs)/settings.tsx` — under Edit profile, a row: **Show my Faves on my profile** with a `Switch` bound to `profile.favesPublic`, optimistic, calling `setFavesPublic`; helper text "Your saved shops and collections. Off means only you see them." Commit.

### Task 11: Feed cards open collections

**File:** `apps/app/components/feed/collection-card.tsx` — wrap in `Pressable` → `/collection/${item.id}`, accessibilityRole "link". Commit.

### Task 12: Finish

- [ ] `pnpm turbo run typecheck test --filter=@coffeesnob/supabase --filter=app --filter=web` all green.
- [ ] Screens on the Expo web build (port 8099) at 500px and 1400px: profile (own, visitor), collection page (owner, visitor), sheet, Top 4 picker, Settings.
- [ ] Tracker status line in `docs/v1-launch-tracker.md`; merge to main; push; check both Vercel deploys.
