# Photos Phase 0 — Groundwork Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give photos a bucket, one shared set of limits, safe tables, and a terms page, so Phase 1 can build uploads on top.

**Architecture:** An R2 bucket is set up by the owner. `packages/supabase/src/photos.ts` holds limits and path/URL helpers for app and web. Migration `0038_log_photos.sql` adds `log_photos`, `photo_flags` and `shops.header_photo_id`, with trigger-enforced caps, ownership and pin rules, tested on PGlite. A static `/terms` page in `apps/web` carries the photo license.

**Tech Stack:** Supabase Postgres (RLS, plpgsql), PGlite + Vitest, TypeScript, Next.js App Router, Cloudflare R2.

Spec: `docs/superpowers/specs/2026-09-30-photos-phase-0-groundwork-design.md` (parent: `2026-09-30-photos-design.md`).

---

## File map

| File | Responsibility |
| --- | --- |
| `packages/supabase/src/photos.ts` | `PHOTO_LIMITS`, `photoPaths`, `photoUrl` |
| `packages/supabase/test/photos.test.ts` | Unit tests for the helpers |
| `packages/supabase/src/index.ts` | Export the above |
| `supabase/migrations/0038_log_photos.sql` | Tables, triggers, RLS, rollback note |
| `packages/supabase/test/photos-sql.test.ts` | PGlite: caps, ownership, paths, RLS, flags, pins |
| `apps/web/app/terms/page.tsx` | `/terms` with the "Your photos" section |
| `apps/web/components/web-chrome.tsx:54` | Footer link |
| `docs/v1-launch-tracker.md` | Status line |

---

### Task 1: Shared photo config

**Files:**
- Create: `packages/supabase/src/photos.ts`
- Create: `packages/supabase/test/photos.test.ts`
- Modify: `packages/supabase/src/index.ts` (append exports)

- [ ] **Step 1: Write the failing test**

`packages/supabase/test/photos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PHOTO_LIMITS, photoPaths, photoUrl } from "../src/photos";

const LOG = "11111111-1111-4111-8111-111111111111";
const PHOTO = "22222222-2222-4222-8222-222222222222";

describe("photoPaths", () => {
  it("puts both sizes under the log, named by photo id", () => {
    expect(photoPaths(LOG, PHOTO, "webp")).toEqual({
      path: `logs/${LOG}/${PHOTO}.webp`,
      thumbPath: `logs/${LOG}/${PHOTO}_t.webp`,
    });
  });

  it("follows the format for the JPEG fallback", () => {
    expect(photoPaths(LOG, PHOTO, "jpg").thumbPath).toBe(`logs/${LOG}/${PHOTO}_t.jpg`);
  });
});

describe("photoUrl", () => {
  it("joins base and path with exactly one slash", () => {
    expect(photoUrl("https://photos.example.com", "logs/a/b.webp")).toBe("https://photos.example.com/logs/a/b.webp");
    expect(photoUrl("https://photos.example.com//", "logs/a/b.webp")).toBe("https://photos.example.com/logs/a/b.webp");
  });
});

describe("PHOTO_LIMITS", () => {
  it("keeps the thumbnail smaller than the full size", () => {
    expect(PHOTO_LIMITS.thumb.longEdge).toBeLessThan(PHOTO_LIMITS.full.longEdge);
    expect(PHOTO_LIMITS.headerMinShortEdge).toBeLessThanOrEqual(PHOTO_LIMITS.full.longEdge);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @coffeesnob/supabase test -- photos.test`
Expected: FAIL, `Failed to resolve import "../src/photos"`.

- [ ] **Step 3: Write the config**

`packages/supabase/src/photos.ts`:

```ts
// Photo limits and file layout, shared by the app and web. The two caps are
// also hard-coded in supabase/migrations/0038_log_photos.sql; the PGlite test
// (test/photos-sql.test.ts) drives them with these values, so they can't drift.
// Spec: docs/superpowers/specs/2026-09-30-photos-design.md.
export const PHOTO_LIMITS = {
  perLog: 1,
  perUserPerDay: 20,
  full: { longEdge: 1600, quality: 0.7 },
  thumb: { longEdge: 640, quality: 0.65 },
  jpegFallbackQuality: 0.75,
  blurhash: { x: 4, y: 3 },
  headerMinShortEdge: 600,
  maxFullBytes: 400_000,
  maxThumbBytes: 80_000,
  signedUrlSeconds: 300,
  retryHours: 24,
  flagsToHide: 2,
  storageWarnRatio: 0.7,
} as const;

export type PhotoExt = "webp" | "jpg";

export function photoPaths(logId: string, photoId: string, ext: PhotoExt) {
  const base = `logs/${logId}/${photoId}`;
  return { path: `${base}.${ext}`, thumbPath: `${base}_t.${ext}` };
}

// The only way to build an image URL. The database stores paths, never URLs,
// so moving providers is a base-URL change.
export function photoUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${path}`;
}
```

Append to `packages/supabase/src/index.ts`:

```ts
export { PHOTO_LIMITS, photoPaths, photoUrl, type PhotoExt } from "./photos";
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @coffeesnob/supabase test -- photos.test && pnpm --filter @coffeesnob/supabase typecheck`
Expected: 4 tests PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/src/photos.ts packages/supabase/test/photos.test.ts packages/supabase/src/index.ts
git commit -m "Photos: shared limits and path/URL helpers"
```

---

### Task 2: SQL test for migration 0038 (write first)

**Files:**
- Create: `packages/supabase/test/photos-sql.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @coffeesnob/supabase test -- photos-sql`
Expected: FAIL, `ENOENT ... 0038_log_photos.sql`.

---

### Task 3: Migration 0038

**Files:**
- Create: `supabase/migrations/0038_log_photos.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Photos Phase 0 (docs/superpowers/specs/2026-09-30-photos-phase-0-groundwork-design.md):
-- log_photos, photo_flags, shops.header_photo_id. No app code writes these yet;
-- Phase 1's confirm route inserts log_photos rows with the service role.
--
-- The caps below (1 photo per log, 20 uploads and 20 flags per user per day)
-- match PHOTO_LIMITS in packages/supabase/src/photos.ts. The PGlite test drives
-- them with those values, so change both together.
--
-- Rollback:
--   drop trigger shops_header_photo on public.shops;
--   alter table public.shops drop column header_photo_id;
--   drop table public.photo_flags;
--   drop table public.log_photos;
--   drop function public.log_photos_before_insert(), public.limit_photo_flags(), public.check_header_photo();

-- ── Photos on logs ──────────────────────────────────────────────────────
create table public.log_photos (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.logs (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  path text not null,
  thumb_path text not null,
  width smallint not null check (width between 1 and 1600),
  height smallint not null check (height between 1 and 1600),
  blurhash text check (char_length(blurhash) <= 100),
  status text not null default 'live' check (status in ('live', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  -- Files live at logs/<log_id>/<id>.<ext> and <id>_t.<ext>; nothing user-named.
  constraint log_photos_path check (path = 'logs/' || log_id || '/' || id || '.webp' or path = 'logs/' || log_id || '/' || id || '.jpg'),
  constraint log_photos_thumb_path check (thumb_path = 'logs/' || log_id || '/' || id || '_t.webp' or thumb_path = 'logs/' || log_id || '/' || id || '_t.jpg')
);

create index log_photos_shop_live_idx on public.log_photos (shop_id) where status = 'live';
create index log_photos_log_idx on public.log_photos (log_id);
create index log_photos_user_day_idx on public.log_photos (user_id, created_at);

-- Owner must own the log; shop comes from the log; caps.
-- ponytail: count-then-insert can race by one under concurrent uploads from the
-- same user; fine for a cap, add an advisory lock if it ever matters.
create or replace function public.log_photos_before_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_owner uuid;
  v_shop uuid;
begin
  select user_id, shop_id into v_owner, v_shop from public.logs where id = new.log_id;
  if v_owner is distinct from new.user_id then
    raise exception 'Photo owner must own the log' using errcode = 'P0001';
  end if;
  new.shop_id := v_shop;
  if (select count(*) from public.log_photos where log_id = new.log_id and status <> 'removed') >= 1 then
    raise exception 'This log already has a photo' using errcode = 'P0001';
  end if;
  if (select count(*) from public.log_photos
      where user_id = new.user_id and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'Too many photos today' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.log_photos_before_insert() from public, anon, authenticated;

create trigger log_photos_before_insert before insert on public.log_photos
  for each row execute function public.log_photos_before_insert();

alter table public.log_photos enable row level security;
-- No insert policy: rows come only from the service role (Phase 1 confirm route).
create policy "live photos are public; owners and admins see all" on public.log_photos for select
  using (status = 'live' or user_id = (select auth.uid()) or public.is_admin());
create policy "owners delete their photos" on public.log_photos for delete
  using (user_id = (select auth.uid()));
create policy "admins update photos" on public.log_photos for update
  using (public.is_admin()) with check (public.is_admin());

-- ── Flags: user reports on photos ───────────────────────────────────────
create table public.photo_flags (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.log_photos (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  reason text not null check (reason in ('wrong_shop', 'inappropriate', 'not_theirs', 'other')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (photo_id, user_id)
);

create index photo_flags_open_idx on public.photo_flags (photo_id) where resolved_at is null;
create index photo_flags_user_idx on public.photo_flags (user_id, created_at);

alter table public.photo_flags enable row level security;
create policy "users see their own photo flags, admins see all" on public.photo_flags for select
  using (user_id = (select auth.uid()) or public.is_admin());
create policy "active users flag photos" on public.photo_flags for insert
  with check (user_id = (select auth.uid()) and public.is_active() and resolved_at is null);
create policy "admins resolve photo flags" on public.photo_flags for update
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.limit_photo_flags()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.photo_flags
      where user_id = new.user_id and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'Too many reports today' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_photo_flags() from public, anon, authenticated;

create trigger photo_flags_rate_limit before insert on public.photo_flags
  for each row execute function public.limit_photo_flags();

-- ── Pinned header ───────────────────────────────────────────────────────
-- Admins already update shops (0018). The trigger keeps a pin honest.
alter table public.shops
  add column header_photo_id uuid references public.log_photos (id) on delete set null;

create or replace function public.check_header_photo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.header_photo_id is not null and not exists (
    select 1 from public.log_photos
    where id = new.header_photo_id and shop_id = new.id and status = 'live'
  ) then
    raise exception 'Header must be a live photo of this shop' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.check_header_photo() from public, anon, authenticated;

create trigger shops_header_photo before insert or update of header_photo_id on public.shops
  for each row execute function public.check_header_photo();
```

Note: the pin error text is "Header must be a live photo of this shop", which the test matches with `/live photo of this shop/`.

- [ ] **Step 2: Run the SQL test**

Run: `pnpm --filter @coffeesnob/supabase test -- photos-sql`
Expected: all tests PASS. If the path-check test fails because PGlite won't concatenate `uuid || text`, cast explicitly (`log_id::text`, `id::text`) in both constraints and re-run.

- [ ] **Step 3: Run the whole package**

Run: `pnpm --filter @coffeesnob/supabase test && pnpm --filter @coffeesnob/supabase typecheck`
Expected: every test passes, including the existing SQL suites.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0038_log_photos.sql packages/supabase/test/photos-sql.test.ts
git commit -m "Photos: log_photos, photo_flags and pinned headers (0038)"
```

---

### Task 4: `/terms` page and footer link

**Files:**
- Create: `apps/web/app/terms/page.tsx`
- Modify: `apps/web/components/web-chrome.tsx:54`

- [ ] **Step 1: Write the page** (copy follows PRODUCT.md: short, plain, no selling)

```tsx
import type { Metadata } from "next";
import { Eyebrow } from "@/components/primitives";
import { WebNav, WebFooter } from "@/components/web-chrome";

// Starts with the photo license (docs/superpowers/specs/2026-09-30-photos-design.md,
// section 8). Full Terms of Service and a Privacy Policy are separate work.
export const metadata: Metadata = {
  title: "Terms — Coffee Snob",
  description: "What happens to the photos you add to Coffee Snob.",
};

export default function TermsPage() {
  return (
    <div className="snob-web">
      <WebNav />
      <main>
        <section className="pagehead">
          <div className="wrap pagehead-in">
            <div>
              <Eyebrow>Terms</Eyebrow>
              <h1 className="h1">The <em>fine</em> print</h1>
            </div>
            <div>
              <p className="lede">Short, because it should be.</p>
            </div>
          </div>
        </section>
        <section className="wrap" style={{ paddingBlock: 48, display: "grid", gap: 16, maxWidth: 720 }}>
          <h2 className="h3">Your photos</h2>
          <p className="body">You keep the rights to your photos. When you add one to a log, you let Coffee Snob show it in the app and on this site, including as the header on that shop&apos;s page. It always carries your name.</p>
          <p className="body">Only add photos you took. By adding one, you confirm you did.</p>
          <p className="body">Delete the photo or the log and it comes down. We take down photos that break these rules, and ones people report that don&apos;t hold up.</p>
        </section>
      </main>
      <WebFooter />
    </div>
  );
}
```

- [ ] **Step 2: Link it from the footer**

In `apps/web/components/web-chrome.tsx`, change:

```tsx
    ["About", [["Data sources", "/data-sources"]]],
```

to:

```tsx
    ["About", [["Data sources", "/data-sources"], ["Terms", "/terms"]]],
```

- [ ] **Step 3: Build and test web**

Run: `pnpm --filter web test && pnpm --filter web build`
Expected: tests pass, and the build lists `/terms` as a static route. If the package filter name differs, check `apps/web/package.json` `name`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/terms/page.tsx apps/web/components/web-chrome.tsx
git commit -m "Terms page with the photo license"
```

---

### Task 5: R2 bucket (owner, in the Cloudflare dashboard)

No code. The owner does these steps. The agent records the result.

- [ ] **Step 1:** Cloudflare dashboard → R2 → create bucket `photos` (Standard, automatic location). If Cloudflare asks for a payment method to turn on R2, add one. Nothing is charged inside the free tier.
- [ ] **Step 2:** Bucket → Settings → Public access → turn on the `r2.dev` subdomain. Copy the URL (`https://pub-<hash>.r2.dev`).
- [ ] **Step 3:** Bucket → Settings → CORS policy:

```json
[
  {
    "AllowedOrigins": ["https://app.coffeesnobproject.com", "https://coffeesnobproject.com", "http://localhost:8081"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

- [ ] **Step 4:** R2 → Manage API tokens → create a token with **Object Read & Write**, limited to bucket `photos`. Copy the Access Key ID, Secret Access Key and Account ID.
- [ ] **Step 5:** Add env vars (the owner runs these, pasting values when prompted):

```bash
cd apps/web
vercel env add R2_ACCOUNT_ID
vercel env add R2_ACCESS_KEY_ID
vercel env add R2_SECRET_ACCESS_KEY
vercel env add R2_BUCKET          # photos
vercel env add NEXT_PUBLIC_PHOTOS_URL   # the r2.dev URL
cd ../app
vercel env add EXPO_PUBLIC_PHOTOS_URL   # the r2.dev URL
```

Add each to Production, Preview and Development.

- [ ] **Step 6:** Check: `vercel env ls` in each app shows the names. Never paste the secret values into chat or the repo.

---

### Task 6: Apply 0038 to production

- [ ] **Step 1: Read-only pre-check** with the Supabase MCP `execute_sql`:

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('log_photos', 'photo_flags');
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'shops' and column_name = 'header_photo_id';
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'logs' and column_name in ('id', 'user_id', 'shop_id');
```

Expected: no `log_photos` or `photo_flags` table, no `header_photo_id` column, and `logs` has uuid `id`, `user_id` and `shop_id`. If either new table already exists, stop and ask.

- [ ] **Step 2:** Apply with MCP `apply_migration`, name `0038_log_photos`, using the file contents.
- [ ] **Step 3:** Run MCP `get_advisors` (security). Expected: nothing new for `log_photos`, `photo_flags` or the three functions. Investigate anything that names them.
- [ ] **Step 4:** Smoke-check: `select count(*) from public.log_photos;` returns 0.

---

### Task 7: Tracker, push

- [ ] **Step 1:** Append to the Status log in `docs/v1-launch-tracker.md`:

```markdown
- 2026-09-30 — Photos Phase 0 (spec `2026-09-30-photos-phase-0-groundwork-design.md`): shared photo limits and path/URL helpers in `packages/supabase`, migration 0038 (`log_photos`, `photo_flags`, `shops.header_photo_id`; caps, ownership and pin rules enforced in the database) applied to production, `/terms` with the photo license. R2 bucket: <done / waiting on owner>. Next: DNS move to Cloudflare, then Phase 1 (upload).
```

- [ ] **Step 2: Commit and push**

```bash
git add docs/v1-launch-tracker.md docs/superpowers/specs/2026-09-30-photos-phase-0-groundwork-design.md docs/superpowers/plans/2026-09-30-photos-phase-0-groundwork.md
git commit -m "Tracker: photos Phase 0"
git push origin main
```
