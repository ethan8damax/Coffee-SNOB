import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

// Runs 0038 and 0039 against a minimal stand-in of the real schema.
const migration = (f: string) => readFileSync(join(__dirname, "../../../supabase/migrations", f), "utf8");
const SCHEMA = `
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create role anon; create role authenticated;
  create table public.profiles (id uuid primary key, username text, is_admin boolean not null default false, status text not null default 'active');
  create function public.is_admin() returns boolean language sql stable as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;
  create function public.is_active() returns boolean language sql stable as $$ select coalesce((select status = 'active' from public.profiles where id = auth.uid()), false) $$;
  create table public.shops (id uuid primary key default gen_random_uuid(), name text not null);
  create table public.logs (id uuid primary key default gen_random_uuid(), user_id uuid not null, shop_id uuid not null references public.shops (id));
  grant usage on schema public, auth to authenticated, anon;
`;

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [MARA, JO] = [uuid(1), uuid(2)];
const [SHOP, OTHER] = [uuid(10), uuid(11)];
let db: PGlite;
let seq = 0;

// A live landscape photo unless told otherwise. One log per photo (the per-log cap is 1).
async function photo(shop: string, user: string, opts: { w?: number; h?: number; status?: string } = {}) {
  const n = ++seq;
  const log = uuid(1000 + n);
  const id = uuid(5000 + n);
  await db.query("insert into logs (id, user_id, shop_id) values ($1, $2, $3)", [log, user, shop]);
  await db.query(
    "insert into log_photos (id, log_id, user_id, path, thumb_path, width, height, status) values ($1, $2, $3, $4, $5, $6, $7, $8)",
    [id, log, user, `logs/${log}/${id}.jpg`, `logs/${log}/${id}_t.jpg`, opts.w ?? 1600, opts.h ?? 1200, opts.status ?? "live"],
  );
  return id;
}

type Row = { shop_id: string; photo_id: string; username: string | null; pinned: boolean; thumb_path: string };
async function headers(shops: string[], day = "2026-09-30", role: "anon" | "authenticated" = "anon") {
  await db.exec(`set role ${role};`);
  try {
    return (await db.query<Row>("select * from shop_headers($1::uuid[], $2::date)", [shops, day])).rows;
  } finally {
    await db.exec("reset role;");
  }
}

beforeEach(async () => {
  seq = 0;
  db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(migration("0038_log_photos.sql"));
  await db.exec(migration("0039_shop_headers.sql"));
  await db.exec("grant all on all tables in schema public to authenticated, anon;");
  await db.query("insert into profiles (id, username) values ($1, 'mara'), ($2, 'jo')", [MARA, JO]);
  await db.query("insert into shops (id, name) values ($1, 'Lazy Labrador'), ($2, 'Muchacho')", [SHOP, OTHER]);
});

describe("0039 shop_headers", () => {
  it("returns the pinned photo, with its author", async () => {
    await photo(SHOP, MARA);
    const pinned = await photo(SHOP, JO);
    await db.query("update shops set header_photo_id = $2 where id = $1", [SHOP, pinned]);
    expect(await headers([SHOP])).toEqual([expect.objectContaining({ shop_id: SHOP, photo_id: pinned, username: "jo", pinned: true })]);
  });

  it("falls back to rotation when the pinned photo is no longer live", async () => {
    const only = await photo(SHOP, MARA);
    const pinned = await photo(SHOP, JO);
    await db.query("update shops set header_photo_id = $2 where id = $1", [SHOP, pinned]);
    await db.query("update log_photos set status = 'hidden' where id = $1", [pinned]);
    expect(await headers([SHOP])).toEqual([expect.objectContaining({ photo_id: only, pinned: false })]);
  });

  it("skips hidden photos and ones too small for a header", async () => {
    await photo(SHOP, MARA, { status: "hidden" });
    await photo(SHOP, MARA, { w: 800, h: 500 });
    expect(await headers([SHOP])).toEqual([]);
  });

  it("prefers landscape photos, but uses portrait when that's all there is", async () => {
    await photo(SHOP, MARA, { w: 1200, h: 1600 });
    const wide = await photo(SHOP, JO);
    for (const day of ["2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"]) {
      expect((await headers([SHOP], day))[0].photo_id).toBe(wide);
    }
    const tall = await photo(OTHER, MARA, { w: 1200, h: 1600 });
    expect((await headers([OTHER]))[0].photo_id).toBe(tall);
  });

  it("keeps one photo all day and rotates across days", async () => {
    for (let i = 0; i < 4; i++) await photo(SHOP, MARA);
    const today = (await headers([SHOP]))[0].photo_id;
    expect((await headers([SHOP]))[0].photo_id).toBe(today);
    const picks = new Set<string>();
    for (let d = 1; d <= 30; d++) picks.add((await headers([SHOP], `2026-10-${String(d).padStart(2, "0")}`))[0].photo_id);
    expect(picks.size).toBeGreaterThan(1);
  });

  it("answers for several shops at once, one row each", async () => {
    await photo(SHOP, MARA);
    await photo(SHOP, JO);
    await photo(OTHER, JO);
    const rows = await headers([SHOP, OTHER], "2026-09-30", "authenticated");
    expect(rows.map((r) => r.shop_id).sort()).toEqual([SHOP, OTHER]);
    expect(await headers([])).toEqual([]);
  });
});
