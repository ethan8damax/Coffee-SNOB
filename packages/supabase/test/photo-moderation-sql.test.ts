import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

// Runs 0038 and 0040 against a minimal stand-in of the real schema, including
// the notifications table as 0037 left it.
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
  create table public.notifications (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles (id),
    kind text not null, shop_id uuid references public.shops (id), flag_id uuid, message_id uuid, submission_id uuid,
    created_at timestamptz not null default now(), read_at timestamptz,
    constraint notifications_kind_check check (kind in ('snob_approved', 'shop_added', 'shop_declined', 'report_done', 'report_passed', 'message_done', 'message_passed')),
    constraint notifications_target check (shop_id is not null or submission_id is not null or flag_id is not null or message_id is not null)
  );
  grant usage on schema public, auth to authenticated, anon;
`;

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [MARA, JO, SAM, ADMIN] = [uuid(1), uuid(2), uuid(3), uuid(4)];
const SHOP = uuid(10);
let db: PGlite;
let seq = 0;

async function as<T>(user: string, sql: string, params: unknown[] = []) {
  await db.exec(`set test.uid = '${user}'; set role authenticated;`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role;");
  }
}

async function photo(user = MARA) {
  const n = ++seq;
  const [log, id] = [uuid(1000 + n), uuid(5000 + n)];
  await db.query("insert into logs (id, user_id, shop_id) values ($1, $2, $3)", [log, user, SHOP]);
  await db.query(
    "insert into log_photos (id, log_id, user_id, path, thumb_path, width, height) values ($1, $2, $3, $4, $5, 1600, 1200)",
    [id, log, user, `logs/${log}/${id}.jpg`, `logs/${log}/${id}_t.jpg`],
  );
  return id;
}
const report = (user: string, photoId: string, reason = "wrong_shop") => as(user, "insert into photo_flags (photo_id, reason) values ($1, $2)", [photoId, reason]);
const statusOf = async (id: string) => (await db.query<{ status: string }>("select status from log_photos where id = $1", [id])).rows[0].status;
const decide = (user: string, id: string, outcome: string) => as<{ decide_photo: number }>(user, "select decide_photo($1, $2)", [id, outcome]);

beforeEach(async () => {
  seq = 0;
  db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(migration("0038_log_photos.sql"));
  await db.exec(migration("0040_photo_moderation.sql"));
  await db.exec("grant all on all tables in schema public to authenticated, anon;");
  await db.query("insert into profiles (id, username, is_admin) values ($1, 'mara', false), ($2, 'jo', false), ($3, 'sam', false), ($4, 'desk', true)", [MARA, JO, SAM, ADMIN]);
  await db.query("insert into shops (id, name) values ($1, 'Muchacho')", [SHOP]);
});

describe("0040 auto-hide", () => {
  it("one report leaves the photo up; a second person's report hides it", async () => {
    const p = await photo();
    await report(JO, p);
    expect(await statusOf(p)).toBe("live");
    await report(SAM, p, "inappropriate");
    expect(await statusOf(p)).toBe("hidden");
  });

  it("doesn't count reports already decided", async () => {
    const p = await photo();
    await report(JO, p);
    await decide(ADMIN, p, "kept");
    await report(SAM, p);
    expect(await statusOf(p)).toBe("live");
  });
});

describe("0040 decide_photo", () => {
  it("kept: back to live, reports resolved, each reporter told once", async () => {
    const p = await photo();
    await report(JO, p);
    await report(SAM, p);
    expect(await decide(ADMIN, p, "kept")).toEqual([{ decide_photo: 2 }]);
    expect(await statusOf(p)).toBe("live");
    expect((await db.query("select outcome from photo_flags where resolved_at is not null")).rows).toEqual([{ outcome: "kept" }, { outcome: "kept" }]);
    const notes = (await db.query<{ user_id: string; kind: string; shop_id: string }>("select user_id, kind, shop_id from notifications order by user_id")).rows;
    expect(notes).toEqual([
      { user_id: JO, kind: "photo_kept", shop_id: SHOP },
      { user_id: SAM, kind: "photo_kept", shop_id: SHOP },
    ]);
  });

  it("removed: taken down and unpinned", async () => {
    const p = await photo();
    await db.query("update shops set header_photo_id = $1 where id = $2", [p, SHOP]);
    await report(JO, p);
    await decide(ADMIN, p, "removed");
    expect(await statusOf(p)).toBe("removed");
    expect((await db.query("select header_photo_id from shops")).rows).toEqual([{ header_photo_id: null }]);
    expect((await db.query("select kind from notifications")).rows).toEqual([{ kind: "photo_removed" }]);
  });

  it("works with no reports, and doesn't notify the admin", async () => {
    const p = await photo(ADMIN);
    await report(ADMIN, p);
    expect(await decide(ADMIN, p, "removed")).toEqual([{ decide_photo: 1 }]);
    expect((await db.query("select * from notifications")).rows).toEqual([]);
    const q = await photo();
    expect(await decide(ADMIN, q, "removed")).toEqual([{ decide_photo: 0 }]);
    expect(await statusOf(q)).toBe("removed");
  });

  it("is admins only, and only kept or removed", async () => {
    const p = await photo();
    await expect(decide(JO, p, "removed")).rejects.toThrow(/admins only/);
    await expect(decide(ADMIN, p, "maybe")).rejects.toThrow(/kept or removed/);
    expect(await statusOf(p)).toBe("live");
  });
});
