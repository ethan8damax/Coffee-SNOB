import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

// Runs supabase/migrations/0036_shop_submissions.sql against a minimal stand-in
// of the real schema.
const MIGRATION = readFileSync(join(__dirname, "../../../supabase/migrations/0036_shop_submissions.sql"), "utf8");
const SCHEMA = `
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create role anon; create role authenticated;
  create table public.profiles (id uuid primary key, is_admin boolean not null default false, status text not null default 'active');
  create function public.is_admin() returns boolean language sql stable as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;
  create function public.is_active() returns boolean language sql stable as $$ select coalesce((select status = 'active' from public.profiles where id = auth.uid()), false) $$;
  create function public.is_chain_name(p text) returns boolean language sql as $$ select p ilike 'starbucks%' $$;
  create table public.shops (
    id uuid primary key default gen_random_uuid(), external_id text, name text not null, lat float8, lng float8,
    address text, website text, phone text, hours text, locality text, region text, country_code text
  );
  create unique index shops_external_id_key on public.shops (external_id) where external_id is not null;
  create table public.notifications (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles (id),
    kind text not null check (kind in ('snob_approved')), shop_id uuid not null references public.shops (id),
    created_at timestamptz not null default now(), read_at timestamptz, unique (user_id, kind, shop_id)
  );
  grant usage on schema public, auth to authenticated, anon;
`;
const GRANTS = "grant all on all tables in schema public to authenticated, anon;";

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [ANA, ADMIN] = [uuid(1), uuid(2)];
let db: PGlite;

async function as<T>(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`set test.uid = '${user ?? ""}'; set role ${user ? "authenticated" : "anon"};`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role;");
  }
}
const submit = (user: string, name = "Wuz Here") =>
  as<{ submission_id: string; shop_id: string | null }>(user, "select * from submit_shop($1, 27.96, -82.46, '1 Main St', 'Mo-Fr 07:00-15:00', 'instagram.com/x', 'Onyx')", [name]);

beforeEach(async () => {
  db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(MIGRATION);
  await db.exec(GRANTS);
  await db.query("insert into public.profiles (id, is_admin) values ($1, false), ($2, true)", [ANA, ADMIN]);
});

describe("0036 shop submissions", () => {
  it("a user's add waits for an admin and makes no shop", async () => {
    const [row] = await submit(ANA);
    expect(row.shop_id).toBeNull();
    const [s] = await as<{ status: string; website: string | null }>(ANA, "select status, website from shop_submissions");
    expect(s).toEqual({ status: "pending", website: null }); // not http(s) → dropped
    expect((await db.query("select * from shops")).rows).toHaveLength(0);
  });

  it("an admin's add goes live at once", async () => {
    const [row] = await submit(ADMIN);
    expect(row.shop_id).not.toBeNull();
    const [shop] = (await db.query<{ external_id: string }>("select external_id from shops")).rows;
    expect(shop.external_id).toMatch(/^user\//);
  });

  it("refuses chains and caps a day at 10", async () => {
    await expect(submit(ANA, "Starbucks Reserve")).rejects.toThrow(/chain/);
    for (let i = 0; i < 10; i++) await submit(ANA, `Shop ${i}`);
    await expect(submit(ANA, "One more")).rejects.toThrow(/10 shops/);
  });

  it("senders see only their own; admins see all", async () => {
    await submit(ANA);
    await submit(ADMIN, "Lunar");
    expect(await as(ANA, "select name from shop_submissions")).toEqual([{ name: "Wuz Here" }]);
    expect(await as(ADMIN, "select name from shop_submissions")).toHaveLength(2);
    await expect(as(ANA, "insert into shop_submissions (user_id, name, lat, lng) values ($1, 'x', 0, 0)", [ANA])).rejects.toThrow();
  });

  it("approve uses the admin's edits, creates the shop, tells the sender", async () => {
    const [{ submission_id }] = await submit(ANA);
    await expect(as(ANA, "select approve_shop_submission($1, 'x', 0, 0)", [submission_id])).rejects.toThrow(/admins only/);
    const [{ approve_shop_submission: shopId }] = await as<{ approve_shop_submission: string }>(
      ADMIN, "select approve_shop_submission($1, 'Wuz Here Coffee', 27.9601, -82.4601, '2 Main St', null, 'https://wuzhere.com')", [submission_id]);
    const [shop] = (await db.query("select name, lat, address, website, hours from shops where id = $1", [shopId])).rows;
    expect(shop).toEqual({ name: "Wuz Here Coffee", lat: 27.9601, address: "2 Main St", website: "https://wuzhere.com", hours: null });
    expect(await as(ANA, "select kind, shop_id from notifications")).toEqual([{ kind: "shop_added", shop_id: shopId }]);
    await expect(as(ADMIN, "select approve_shop_submission($1, 'x', 0, 0)", [submission_id])).rejects.toThrow(/already decided/);
  });

  it("decline records the reason and tells the sender", async () => {
    const [{ submission_id }] = await submit(ANA);
    await as(ADMIN, "select decline_shop_submission($1, 'Tea only')", [submission_id]);
    const [s] = await as(ANA, "select status, decline_reason from shop_submissions");
    expect(s).toEqual({ status: "declined", decline_reason: "Tea only" });
    expect(await as(ANA, "select kind, submission_id from notifications")).toEqual([{ kind: "shop_declined", submission_id }]);
  });

  it("only admins create new user/ shops; logging an existing one still works", async () => {
    await expect(as(ANA, "insert into shops (external_id, name) values ('user/abc', 'Sneaky')")).rejects.toThrow(/approval/);
    await as(ADMIN, "insert into shops (external_id, name) values ('user/abc', 'Real')");
    await as(ANA, "insert into shops (external_id, name) values ('user/abc', 'Real') on conflict (external_id) where external_id is not null do nothing");
    await as(ANA, "insert into shops (external_id, name) values ('osm:node/1', 'Index café')");
    expect((await db.query("select * from shops")).rows).toHaveLength(2);
  });
});
