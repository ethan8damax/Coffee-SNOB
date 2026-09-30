import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { PHOTO_LIMITS } from "../src/photos";

// Runs 0038 against a minimal stand-in of the real schema. The default PGlite
// user is a superuser, which bypasses RLS the way the service role does.
const migration = (f: string) => readFileSync(join(__dirname, "../../../supabase/migrations", f), "utf8");
const SCHEMA = `
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create role anon; create role authenticated;
  create table public.profiles (id uuid primary key, is_admin boolean not null default false, status text not null default 'active');
  create function public.is_admin() returns boolean language sql stable as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;
  create function public.is_active() returns boolean language sql stable as $$ select coalesce((select status = 'active' from public.profiles where id = auth.uid()), false) $$;
  create table public.shops (id uuid primary key default gen_random_uuid(), name text not null);
  create table public.logs (id uuid primary key default gen_random_uuid(), user_id uuid not null, shop_id uuid not null references public.shops (id));
  grant usage on schema public, auth to authenticated, anon;
`;
const GRANTS = "grant all on all tables in schema public to authenticated, anon;";

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [ANA, BO, ADMIN, BANNED] = [uuid(1), uuid(2), uuid(3), uuid(4)];
const [SHOP, OTHER_SHOP] = [uuid(10), uuid(11)];
const logId = (n: number) => uuid(1000 + n); // ANA's logs at SHOP
const BO_LOG = uuid(2000);
let db: PGlite;
let seq = 0;

async function as<T>(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`set test.uid = '${user ?? ""}'; set role ${user ? "authenticated" : "anon"};`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role;");
  }
}

// Service-role insert, the way Phase 1's confirm route will write.
async function addPhoto(log: string, user: string, opts: { status?: string; badPath?: boolean } = {}) {
  const id = uuid(5000 + ++seq);
  const path = opts.badPath ? `logs/${log}/someone-else.webp` : `logs/${log}/${id}.webp`;
  await db.query(
    "insert into log_photos (id, log_id, user_id, path, thumb_path, width, height, status) values ($1, $2, $3, $4, $5, 1600, 1200, $6)",
    [id, log, user, path, `logs/${log}/${id}_t.webp`, opts.status ?? "live"],
  );
  return id;
}

beforeEach(async () => {
  seq = 0;
  db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(migration("0038_log_photos.sql"));
  await db.exec(GRANTS);
  await db.query(
    "insert into profiles (id, is_admin, status) values ($1, false, 'active'), ($2, false, 'active'), ($3, true, 'active'), ($4, false, 'suspended')",
    [ANA, BO, ADMIN, BANNED],
  );
  await db.query("insert into shops (id, name) values ($1, 'Two Fold'), ($2, 'Muchacho')", [SHOP, OTHER_SHOP]);
  for (let n = 0; n <= PHOTO_LIMITS.perUserPerDay; n++) {
    await db.query("insert into logs (id, user_id, shop_id) values ($1, $2, $3)", [logId(n), ANA, SHOP]);
  }
  await db.query("insert into logs (id, user_id, shop_id) values ($1, $2, $3)", [BO_LOG, BO, OTHER_SHOP]);
});

describe("0038 log_photos: writes", () => {
  it("copies the shop from the log", async () => {
    const id = await addPhoto(logId(0), ANA);
    expect(await db.query("select shop_id from log_photos where id = $1", [id]).then((r) => r.rows)).toEqual([{ shop_id: SHOP }]);
  });

  it("refuses a photo whose owner doesn't own the log", async () => {
    await expect(addPhoto(logId(0), BO)).rejects.toThrow(/own the log/);
  });

  it("refuses a path outside the log's folder or not named by the photo id", async () => {
    await expect(addPhoto(logId(0), ANA, { badPath: true })).rejects.toThrow(/log_photos_path/);
  });

  it(`caps photos per log at ${PHOTO_LIMITS.perLog}, but a removed photo can be replaced`, async () => {
    const first = await addPhoto(logId(0), ANA);
    await expect(addPhoto(logId(0), ANA)).rejects.toThrow(/already has/);
    await db.query("update log_photos set status = 'removed' where id = $1", [first]);
    await expect(addPhoto(logId(0), ANA)).resolves.toBeTruthy();
  });

  it(`caps uploads at ${PHOTO_LIMITS.perUserPerDay} per user per day`, async () => {
    for (let n = 0; n < PHOTO_LIMITS.perUserPerDay; n++) await addPhoto(logId(n), ANA);
    await expect(addPhoto(logId(PHOTO_LIMITS.perUserPerDay), ANA)).rejects.toThrow(/Too many photos today/);
  });

  it("signed-in users can't insert rows directly", async () => {
    await expect(
      as(ANA, "insert into log_photos (log_id, user_id, path, thumb_path, width, height) values ($1, $2, 'x', 'y', 1, 1)", [logId(0), ANA]),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("0038 log_photos: reads, deletes, updates", () => {
  it("shows live photos to everyone, hidden ones only to the owner and admins", async () => {
    await addPhoto(logId(0), ANA);
    await addPhoto(logId(1), ANA, { status: "hidden" });
    expect(await as(null, "select status from log_photos")).toEqual([{ status: "live" }]);
    expect(await as(BO, "select status from log_photos")).toEqual([{ status: "live" }]);
    expect(await as(ANA, "select count(*)::int as n from log_photos")).toEqual([{ n: 2 }]);
    expect(await as(ADMIN, "select count(*)::int as n from log_photos")).toEqual([{ n: 2 }]);
  });

  it("owners delete their own photos, nobody else's", async () => {
    const mine = await addPhoto(logId(0), ANA);
    expect(await as(BO, "delete from log_photos where id = $1 returning id", [mine])).toEqual([]);
    expect(await as(ANA, "delete from log_photos where id = $1 returning id", [mine])).toEqual([{ id: mine }]);
  });

  it("only admins change status", async () => {
    const id = await addPhoto(logId(0), ANA);
    expect(await as(ANA, "update log_photos set status = 'live' where id = $1 returning id", [id])).toEqual([]);
    expect(await as(ADMIN, "update log_photos set status = 'hidden' where id = $1 returning status", [id])).toEqual([{ status: "hidden" }]);
  });

  it("deleting a log deletes its photo rows", async () => {
    await addPhoto(logId(0), ANA);
    await db.query("delete from logs where id = $1", [logId(0)]);
    expect((await db.query("select * from log_photos")).rows).toEqual([]);
  });
});

describe("0038 photo_flags", () => {
  const flagIt = (user: string, photo: string, reason = "wrong_shop") =>
    as(user, "insert into photo_flags (photo_id, reason) values ($1, $2)", [photo, reason]);

  it("an active user flags a photo once", async () => {
    const photo = await addPhoto(logId(0), ANA);
    await flagIt(BO, photo);
    await expect(flagIt(BO, photo, "other")).rejects.toThrow(/duplicate key/);
  });

  it("suspended users can't flag, and nobody files a flag as already resolved", async () => {
    const photo = await addPhoto(logId(0), ANA);
    await expect(flagIt(BANNED, photo)).rejects.toThrow(/row-level security/);
    await expect(as(BO, "insert into photo_flags (photo_id, reason, resolved_at) values ($1, 'other', now())", [photo])).rejects.toThrow(/row-level security/);
  });

  it("people see their own flags; admins see all and resolve", async () => {
    const photo = await addPhoto(logId(0), ANA);
    await flagIt(BO, photo);
    expect(await as(ANA, "select * from photo_flags")).toEqual([]);
    expect(await as(BO, "select reason from photo_flags")).toEqual([{ reason: "wrong_shop" }]);
    expect(await as(ADMIN, "update photo_flags set resolved_at = now() returning reason")).toEqual([{ reason: "wrong_shop" }]);
  });

  it("rejects unknown reasons", async () => {
    const photo = await addPhoto(logId(0), ANA);
    await expect(flagIt(BO, photo, "ugly")).rejects.toThrow(/photo_flags_reason_check/);
  });
});

describe("0038 shops.header_photo_id", () => {
  const pin = (shop: string, photo: string | null) =>
    db.query("update shops set header_photo_id = $2 where id = $1", [shop, photo]);

  it("pins a live photo of the same shop", async () => {
    const photo = await addPhoto(logId(0), ANA);
    await pin(SHOP, photo);
    expect((await db.query("select header_photo_id from shops where id = $1", [SHOP])).rows).toEqual([{ header_photo_id: photo }]);
  });

  it("refuses a photo of another shop, or one that isn't live", async () => {
    const other = await addPhoto(BO_LOG, BO);
    const hidden = await addPhoto(logId(0), ANA, { status: "hidden" });
    await expect(pin(SHOP, other)).rejects.toThrow(/live photo of this shop/);
    await expect(pin(SHOP, hidden)).rejects.toThrow(/live photo of this shop/);
  });

  it("unpins when the photo row goes away", async () => {
    const photo = await addPhoto(logId(0), ANA);
    await pin(SHOP, photo);
    await db.query("delete from log_photos where id = $1", [photo]);
    expect((await db.query("select header_photo_id from shops where id = $1", [SHOP])).rows).toEqual([{ header_photo_id: null }]);
  });
});
