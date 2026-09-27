import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

// Runs supabase/migrations/0032_freshness.sql against a minimal stand-in of
// the real schema.
const MIGRATION = readFileSync(join(__dirname, "../../../supabase/migrations/0032_freshness.sql"), "utf8");

const SCHEMA = `
  create schema auth;
  create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
  create role anon; create role authenticated;
  create function public.is_chain_name(p text) returns boolean language sql as $$ select p ilike 'starbucks%' $$;
  create table public.profiles (id uuid primary key);
  create table public.shops (
    id uuid primary key, name text not null, lat float8, lng float8, city_id uuid, neighborhood text,
    external_id text, locality text, region text, country_code text, city_key text
  );
  create table public.shop_curations (shop_id uuid primary key references public.shops (id), tag text, price_tier text, editorial_rating smallint);
  create table public.logs (
    id uuid primary key default gen_random_uuid(), user_id uuid not null, shop_id uuid not null references public.shops (id),
    rating smallint not null, created_at timestamptz not null default now()
  );
`;

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
let db: PGlite;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(MIGRATION);
  for (const n of [1, 2]) await db.query("insert into public.profiles (id) values ($1)", [uuid(n)]);
  await db.query("insert into public.shops (id, name) values ($1, 'Perc'), ($2, 'Spiller Park')", [uuid(100), uuid(101)]);
});

const notifications = async () =>
  (await db.query<{ user_id: string; shop_id: string }>("select user_id, shop_id from public.notifications")).rows;

describe("freshness", () => {
  it("tells whoever logged the shop first when it's Snob-Approved, once", async () => {
    await db.query("insert into public.logs (user_id, shop_id, rating, created_at) values ($1, $3, 4, now() - interval '2 days'), ($2, $3, 5, now())", [uuid(1), uuid(2), uuid(100)]);
    await db.query("insert into public.shop_curations (shop_id) values ($1)", [uuid(100)]);
    expect(await notifications()).toEqual([{ user_id: uuid(1), shop_id: uuid(100) }]);
    await db.query("delete from public.shop_curations");
    await db.query("insert into public.shop_curations (shop_id) values ($1)", [uuid(100)]);
    expect(await notifications()).toHaveLength(1);
  });

  it("approving a shop nobody logged tells no one", async () => {
    await db.query("insert into public.shop_curations (shop_id) values ($1)", [uuid(101)]);
    expect(await notifications()).toEqual([]);
  });

  it("drops closed shops from shop_ratings", async () => {
    await db.query("insert into public.logs (user_id, shop_id, rating) values ($1, $2, 4), ($1, $3, 4)", [uuid(1), uuid(100), uuid(101)]);
    await db.query("update public.shops set closed_at = now() where id = $1", [uuid(101)]);
    const { rows } = await db.query<{ name: string }>("select name from public.shop_ratings");
    expect(rows.map((r) => r.name)).toEqual(["Perc"]);
  });
});
