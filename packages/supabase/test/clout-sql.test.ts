import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

// Runs supabase/migrations/0030_shop_clout.sql against a minimal stand-in of
// the real schema, so the clout rules are tested as the database runs them.
const MIGRATION = readFileSync(join(__dirname, "../../../supabase/migrations/0030_shop_clout.sql"), "utf8");

const SCHEMA = `
  create schema auth;
  create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
  create role anon; create role authenticated;
  create table public.profiles (id uuid primary key, created_at timestamptz not null default now() - interval '30 days', is_admin boolean not null default false);
  create function public.is_admin() returns boolean language sql as $$ select false $$;
  create table public.shops (id uuid primary key, name text not null, promotion_status text not null default 'none');
  create table public.shop_curations (shop_id uuid primary key references public.shops (id));
  create table public.logs (
    id uuid primary key default gen_random_uuid(), user_id uuid not null, shop_id uuid not null references public.shops (id),
    rating smallint not null, visited_at date not null default current_date, created_at timestamptz not null default now()
  );
  create function public.check_shop_promotion() returns trigger language plpgsql as $$ begin return new; end $$;
  create trigger on_log_insert_check_promotion after insert on public.logs for each row execute function public.check_shop_promotion();
`;

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
let db: PGlite;
let nextUser = 1;

async function shop(n: number, status = "none") {
  await db.query("insert into public.shops (id, name, promotion_status) values ($1, $2, $3)", [uuid(1000 + n), `Shop ${n}`, status]);
  return uuid(1000 + n);
}
async function person(opts: { newAccount?: boolean } = {}) {
  const id = uuid(nextUser++);
  await db.query(`insert into public.profiles (id, created_at) values ($1, ${opts.newAccount ? "now()" : "now() - interval '30 days'"})`, [id]);
  return id;
}
async function log(user: string, shopId: string, rating: number, visitedAt = "now()") {
  await db.query(`insert into public.logs (user_id, shop_id, rating, visited_at) values ($1, $2, $3, (${visitedAt})::date)`, [user, shopId, rating]);
}
async function clout(shopId: string) {
  const { rows } = await db.query<{ loggers: number; adjusted: string }>("select loggers, adjusted from public.shop_clout where shop_id = $1", [shopId]);
  return rows[0] ? { loggers: rows[0].loggers, adjusted: Number(rows[0].adjusted) } : null;
}
const status = async (shopId: string) =>
  (await db.query<{ promotion_status: string }>("select promotion_status from public.shops where id = $1", [shopId])).rows[0].promotion_status;

beforeEach(async () => {
  db = new PGlite();
  nextUser = 1;
  await db.exec(SCHEMA);
  await db.exec(MIGRATION);
});

describe("shop clout", () => {
  it("ranks forty strong ratings above two perfect ones", async () => {
    // A realistic spread elsewhere keeps the global mean near 3.9.
    const plain = await shop(1);
    for (let i = 0; i < 30; i++) await log(await person(), plain, 3);
    const two = await shop(2);
    for (let i = 0; i < 2; i++) await log(await person(), two, 5);
    const forty = await shop(3);
    for (let i = 0; i < 40; i++) await log(await person(), forty, i < 24 ? 5 : 4);
    const a = (await clout(two))!;
    const b = (await clout(forty))!;
    expect(b.adjusted).toBeGreaterThan(a.adjusted);
    expect(b.loggers).toBe(40);
  });

  it("counts each person once, by their latest log", async () => {
    const s = await shop(1);
    const fan = await person();
    for (let i = 0; i < 10; i++) await log(fan, s, 5, `current_date - ${20 - i}`);
    await log(fan, s, 2, "current_date");
    expect((await clout(s))!.loggers).toBe(1);
    const other = await shop(2);
    await log(await person(), other, 5);
    // the fan's latest (2) is what counts, so this shop sits below the other
    expect((await clout(s))!.adjusted).toBeLessThan((await clout(other))!.adjusted);
  });

  it("ignores accounts younger than 7 days", async () => {
    const s = await shop(1);
    await log(await person({ newAccount: true }), s, 5);
    expect(await clout(s)).toEqual({ loggers: 0, adjusted: expect.any(Number) });
  });

  it("gives visits older than 18 months half the weight", async () => {
    const plain = await shop(3);
    for (let i = 0; i < 20; i++) await log(await person(), plain, 3);
    const recent = await shop(1);
    const old = await shop(2);
    for (let i = 0; i < 6; i++) {
      await log(await person(), recent, 5);
      await log(await person(), old, 5, "current_date - interval '2 years'");
    }
    const r = (await clout(recent))!;
    const o = (await clout(old))!;
    expect(o.loggers).toBe(6);
    expect(o.adjusted).toBeLessThan(r.adjusted);
  });

  it("flags a shop for a visit at the bar, never a rejected or curated one", async () => {
    const plain = await shop(1);
    for (let i = 0; i < 20; i++) await log(await person(), plain, 3);
    const good = await shop(2);
    const rejected = await shop(3, "rejected");
    const curated = await shop(4);
    await db.query("insert into public.shop_curations (shop_id) values ($1)", [curated]);
    for (const s of [good, rejected, curated]) for (let i = 0; i < 12; i++) await log(await person(), s, 5);
    expect(await status(good)).toBe("flagged");
    expect(await status(rejected)).toBe("rejected");
    expect(await status(curated)).toBe("none");
    expect(await status(plain)).toBe("none");
  });

  it("drops a shop's clout when its last log is deleted", async () => {
    const s = await shop(1);
    await log(await person(), s, 4);
    expect(await clout(s)).not.toBeNull();
    await db.query("delete from public.logs where shop_id = $1", [s]);
    expect(await clout(s)).toBeNull();
  });
});
