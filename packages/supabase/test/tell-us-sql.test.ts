import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

// Runs the flags half of 0028, then 0036 and 0037, against a minimal stand-in
// of the real schema.
const migration = (f: string) => readFileSync(join(__dirname, "../../../supabase/migrations", f), "utf8");
const FLAGS_0028 = "--" + migration("0028_curation_controls.sql").split("-- ── Overrides")[1];
const SCHEMA = `
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create table auth.users (id uuid primary key, email text);
  create role anon; create role authenticated;
  create table public.profiles (id uuid primary key, is_admin boolean not null default false, status text not null default 'active');
  create function public.is_admin() returns boolean language sql stable as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;
  create function public.is_active() returns boolean language sql stable as $$ select coalesce((select status = 'active' from public.profiles where id = auth.uid()), false) $$;
  create function public.is_chain_name(p text) returns boolean language sql as $$ select false $$;
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
const [ANA, BO, ADMIN, SHOP] = [uuid(1), uuid(2), uuid(3), uuid(9)];
const PLACE = "cs_0123456789ab";
let db: PGlite;

async function as<T>(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`set test.uid = '${user ?? ""}'; set role ${user ? "authenticated" : "anon"};`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role;");
  }
}
const flag = (user: string, kind: string, target: { place?: string; shop?: string }, extra = "") =>
  as(user, `insert into place_flags (place_id, shop_id, place_name, lat, lng, kind${extra ? ", note" : ""}) values ($1, $2, 'Wuz Here', 27.9, -82.4, $3${extra ? ", $4" : ""})`,
    [target.place ?? null, target.shop ?? null, kind, ...(extra ? [extra] : [])]);
const send = (user: string, kind = "bug", body = "The map froze") =>
  as<{ send_message: string }>(user, "select send_message($1, $2, $3)", [kind, body, { platform: "web", screen: "/map" }]);

beforeEach(async () => {
  db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(FLAGS_0028);
  await db.exec(migration("0036_shop_submissions.sql"));
  await db.exec(migration("0037_tell_us.sql"));
  await db.exec(GRANTS);
  await db.query("insert into public.profiles (id, is_admin) values ($1, false), ($2, false), ($3, true)", [ANA, BO, ADMIN]);
  await db.query("insert into auth.users (id, email) values ($1, 'ana@example.com')", [ANA]);
  await db.query("insert into public.shops (id, external_id, name) values ($1, 'osm:node/1', 'Two Fold')", [SHOP]);
});

describe("0037 tell us: shop reports", () => {
  it("reports an index café or one of our shops, with a note, never both", async () => {
    await flag(ANA, "wrong_info", { shop: SHOP }, "Closes at 2 now");
    await flag(ANA, "closed", { place: PLACE });
    expect(await as(ANA, "select kind, note from place_flags where shop_id is not null")).toEqual([{ kind: "wrong_info", note: "Closes at 2 now" }]);
    await expect(flag(ANA, "other", {})).rejects.toThrow(/place_flags_target/);
    await expect(as(ANA, "insert into place_flags (place_id, shop_id, place_name, lat, lng, kind) values ($1, $2, 'x', 0, 0, 'other')", [PLACE, SHOP])).rejects.toThrow(/place_flags_target/);
    await expect(flag(ANA, "wrong_info", { shop: SHOP })).rejects.toThrow(/duplicate key/);
  });

  it("senders can't file a report as already decided", async () => {
    await expect(as(ANA, "insert into place_flags (shop_id, place_name, lat, lng, kind, outcome) values ($1, 'x', 0, 0, 'other', 'done')", [SHOP])).rejects.toThrow(/row-level security/);
  });

  it("hide rules only count index cafés", async () => {
    await flag(ANA, "closed", { place: PLACE });
    await flag(BO, "closed", { place: PLACE });
    await flag(ANA, "closed", { shop: SHOP });
    await flag(BO, "closed", { shop: SHOP });
    expect(await as(null, "select * from active_place_hides()")).toEqual([{ active_place_hides: PLACE }]);
  });

  it("deciding a shop's reports closes them all and tells each sender once", async () => {
    await flag(ANA, "closed", { shop: SHOP });
    await flag(ANA, "wrong_info", { shop: SHOP });
    await flag(BO, "closed", { shop: SHOP });
    await expect(as(ANA, "select decide_place_flags(null, $1, 'done')", [SHOP])).rejects.toThrow(/admins only/);
    const [{ decide_place_flags: n }] = await as<{ decide_place_flags: number }>(ADMIN, "select decide_place_flags(null, $1, 'passed', 'Still open, checked today')", [SHOP]);
    expect(n).toBe(3);
    expect(await as(ANA, "select outcome, reason from place_flags where kind = 'closed'")).toEqual([{ outcome: "passed", reason: "Still open, checked today" }]);
    const notes = (await db.query("select user_id, kind from notifications order by user_id")).rows;
    expect(notes).toEqual([{ user_id: ANA, kind: "report_passed" }, { user_id: BO, kind: "report_passed" }]);
  });
});

describe("0037 tell us: messages", () => {
  it("a signed-in person sends; only they and admins see it", async () => {
    const [{ send_message: id }] = await send(ANA);
    await expect(send(ANA, "idea", "   ")).rejects.toThrow(/needs words/);
    await expect(send(ANA, "complaint")).rejects.toThrow(/kind_check/);
    await expect(as(null, "select send_message('bug', 'x')")).rejects.toThrow(/permission denied/);
    expect(await as(ANA, "select id, status, context from messages")).toEqual([{ id, status: "sent", context: { platform: "web", screen: "/map" } }]);
    expect(await as(BO, "select id from messages")).toEqual([]);
    await expect(as(ANA, "update messages set status = 'done'")).resolves.toEqual([]);
    expect((await db.query("select status from messages")).rows).toEqual([{ status: "sent" }]);
  });

  it("caps a day at 20", async () => {
    for (let i = 0; i < 20; i++) await send(ANA, "idea", `Idea ${i}`);
    await expect(send(ANA)).rejects.toThrow(/too many/);
  });

  it("admin sees it, decides it, and the sender hears back", async () => {
    const [{ send_message: id }] = await send(ANA);
    await as(ADMIN, "select mark_message_seen($1)", [id]);
    expect(await as(ANA, "select status from messages")).toEqual([{ status: "seen" }]);
    expect(await as(ADMIN, "select message_sender_email($1)", [id])).toEqual([{ message_sender_email: "ana@example.com" }]);
    await expect(as(ANA, "select message_sender_email($1)", [id])).rejects.toThrow(/admins only/);
    await as(ADMIN, "select decide_message($1, 'done', 'Fixed in today''s update')", [id]);
    expect(await as(ANA, "select status, reason from messages")).toEqual([{ status: "done", reason: "Fixed in today's update" }]);
    expect(await as(ANA, "select kind, message_id from notifications")).toEqual([{ kind: "message_done", message_id: id }]);
    await expect(as(ADMIN, "select decide_message($1, 'passed')", [id])).rejects.toThrow(/already decided/);
  });
});
