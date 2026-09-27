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
    id uuid primary key default gen_random_uuid(), external_id text, name text not null, lat float8, lng float8,
    address text, website text, phone text, hours text, locality text, region text, country_code text
  );
  create unique index shops_external_id_key on public.shops (external_id) where external_id is not null;
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
  grant usage on schema public, auth to authenticated, anon;
  grant select on auth.users to authenticated, anon;
`;
// Supabase grants table access to both roles; RLS does the real gating.
const GRANTS = "grant all on all tables in schema public to authenticated, anon;";

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
  await db.exec(GRANTS);
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
