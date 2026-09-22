# Admin Dashboard Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up everything the admin dashboard needs before any admin *feature* page can exist: the `is_admin` column/RLS the 2026-08-26 spec designed, the content-table write policies it also designed but never applied, and — the gap that spec assumed away — real Supabase Auth session handling in `apps/web`, which today has none (only the Expo app has auth).

**Architecture:** `@supabase/ssr` gives Next.js a cookie-backed server/middleware Supabase client (the standard pattern for App Router + Supabase Auth). Middleware on `/admin/*` checks the session and the caller's `is_admin` flag, redirecting anyone else to a sign-in page. Nothing here is a new auth *system* — it's the same Supabase Auth every other client already uses, just wired into the one app that hasn't needed it yet.

**Tech Stack:** Postgres/Supabase (migration, RLS, `security_invoker` pattern from `0010_shop_ratings_view.sql`), `@supabase/ssr`, Next.js 15 App Router (Server Actions, middleware, route groups), Vitest.

**Depends on:** nothing. **Unblocks:** `2026-09-22-admin-user-management.md` and every future admin feature plan (shop/city-guide CRUD, blog CMS, merch shell).

**Out of scope:** any admin *feature* page beyond a placeholder dashboard home. Those are separate plans.

---

### Task 1: Migration — `is_admin`, `is_admin()`, and the content-table write policies the 2026-08-26 spec designed

**Files:**
- Create: `supabase/migrations/0018_admin_foundation.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Admin foundation (see docs/superpowers/specs/2026-08-26-map-and-admin-dashboard-design.md
-- and docs/superpowers/plans/2026-09-22-admin-dashboard-foundation.md). Adds the is_admin
-- flag the August spec designed, an is_admin() helper for use inside RLS policies, and the
-- admin write policies on cities/shops/lists/list_items that spec scoped but never applied
-- (today only service_role can write to these tables — no policy exists for anyone else).

alter table public.profiles add column is_admin boolean not null default false;

-- Not security definer: it only reads profiles, which already has a public-read policy
-- ("profiles are publicly readable"), so this needs no elevated privilege — same posture
-- as the non-security-definer helper style used elsewhere in this schema.
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create policy "admins insert cities" on public.cities for insert with check (public.is_admin());
create policy "admins update cities" on public.cities for update using (public.is_admin()) with check (public.is_admin());
create policy "admins delete cities" on public.cities for delete using (public.is_admin());

create policy "admins insert shops" on public.shops for insert with check (public.is_admin());
create policy "admins update shops" on public.shops for update using (public.is_admin()) with check (public.is_admin());
create policy "admins delete shops" on public.shops for delete using (public.is_admin());

create policy "admins insert lists" on public.lists for insert with check (public.is_admin());
create policy "admins update lists" on public.lists for update using (public.is_admin()) with check (public.is_admin());
create policy "admins delete lists" on public.lists for delete using (public.is_admin());

create policy "admins insert list_items" on public.list_items for insert with check (public.is_admin());
create policy "admins update list_items" on public.list_items for update using (public.is_admin()) with check (public.is_admin());
create policy "admins delete list_items" on public.list_items for delete using (public.is_admin());
```

- [ ] **Step 2: Apply the migration to the dev database and verify**

Run: `psql "$DEV_DATABASE_URL" -f supabase/migrations/0018_admin_foundation.sql`

Then verify:
```bash
psql "$DEV_DATABASE_URL" -c "\d public.profiles" -c "\df public.is_admin"
psql "$DEV_DATABASE_URL" -c "select policyname from pg_policies where tablename = 'shops'"
```
Expected: `profiles` shows an `is_admin` column (`boolean`, not null, default `false`); `is_admin` listed as a function; the `shops` policy list includes `admins insert shops`, `admins update shops`, `admins delete shops` alongside the existing `shops are publicly readable`.

Verify a non-admin is actually rejected and an admin actually succeeds:
```bash
psql "$DEV_DATABASE_URL" <<'SQL'
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users limit 1;
  update public.profiles set is_admin = false where id = v_user_id;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_id)::text, true);
  set local role authenticated;
  begin
    insert into public.cities (slug, name, country, region) values ('rls-test', 'RLS Test', 'x', 'x');
    raise exception 'expected non-admin insert to be rejected';
  exception when insufficient_privilege or others then
    raise notice 'non-admin correctly rejected: %', sqlerrm;
  end;
  reset role;
  update public.profiles set is_admin = true where id = v_user_id;
  set local role authenticated;
  insert into public.cities (slug, name, country, region) values ('rls-test', 'RLS Test', 'x', 'x');
  raise notice 'admin insert succeeded';
  reset role;
  delete from public.cities where slug = 'rls-test';
  update public.profiles set is_admin = false where id = v_user_id;
end $$;
SQL
```
Expected: a `NOTICE: non-admin correctly rejected: ...` followed by `NOTICE: admin insert succeeded`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0018_admin_foundation.sql
git commit -m "feat: add is_admin, is_admin(), and admin write policies on content tables"
```

---

### Task 2: Update `packages/supabase/src/types.ts` for `is_admin`

**Files:**
- Modify: `packages/supabase/src/types.ts:315-347` (the `profiles` table type)

- [ ] **Step 1: Add `is_admin` to `Row`, `Insert`, and `Update`**

In the `profiles` entry, change:
```ts
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          onboarded_at: string | null
          taste_picks: string[]
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          onboarded_at?: string | null
          taste_picks?: string[]
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarded_at?: string | null
          taste_picks?: string[]
          username?: string
        }
        Relationships: []
      }
```
to:
```ts
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          is_admin: boolean
          onboarded_at: string | null
          taste_picks: string[]
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_admin?: boolean
          onboarded_at?: string | null
          taste_picks?: string[]
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_admin?: boolean
          onboarded_at?: string | null
          taste_picks?: string[]
          username?: string
        }
        Relationships: []
      }
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/supabase && pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/supabase/src/types.ts
git commit -m "feat: add is_admin to generated profiles type"
```

---

### Task 3: Move `snobStatus`/`TIERS` into `packages/supabase` (DRY fix, needed by the upcoming admin users page)

The admin user-management page (next plan) needs to display each user's snob tier. That logic already exists in `apps/app/lib/profile/status.ts` but apps/web can't import from apps/app. Moving the pure, dependency-free part into the shared package both apps already depend on is the correct fix, not a duplicate copy.

**Files:**
- Create: `packages/supabase/src/profile-status.ts`
- Modify: `packages/supabase/src/index.ts`
- Modify: `apps/app/lib/profile/status.ts`

- [ ] **Step 1: Create the shared module**

```ts
// packages/supabase/src/profile-status.ts
// Snob status is derived from how many visits someone has logged — no stored tier to drift out of sync.
export const TIERS = [
  { name: "Beginner", from: 0 },
  { name: "Regular", from: 5 },
  { name: "Connoisseur", from: 15 },
  { name: "Snob", from: 30 },
  { name: "Head Snob", from: 60 },
] as const;

export function snobStatus(logCount: number): { name: string; next: { name: string; needed: number } | null } {
  const n = Math.max(0, Math.floor(Number.isFinite(logCount) ? logCount : 0));
  const idx = TIERS.reduce((best, t, i) => (n >= t.from ? i : best), 0);
  const next = TIERS[idx + 1];
  return { name: TIERS[idx].name, next: next ? { name: next.name, needed: next.from - n } : null };
}
```

- [ ] **Step 2: Export it from the package**

In `packages/supabase/src/index.ts`, add near the other exports from `./queries`:
```ts
export { TIERS, snobStatus } from "./profile-status";
```

- [ ] **Step 3: Re-export from the old location so existing callers don't change**

Replace the top of `apps/app/lib/profile/status.ts` (the `TIERS`/`snobStatus` definitions) with:
```ts
// Snob status is derived from how many visits someone has logged — no stored tier to drift
// out of sync. Lives in @coffeesnob/supabase so apps/web's admin dashboard can show it too;
// re-exported here so existing imports of "./status" in this app don't change.
export { TIERS, snobStatus } from "@coffeesnob/supabase";
```
Leave `buildHeatmap`, `heatLevel`, `heatmapSince`, and the `DAY_MS`/`toDay`/`parseDay` helpers below it exactly as they are — those are calendar-UI-specific, not shared.

- [ ] **Step 4: Run the existing tests to confirm nothing broke**

Run: `cd apps/app && pnpm test -- status.test.ts`
Expected: PASS (same assertions, now exercising the re-exported function).

Run: `cd packages/supabase && pnpm typecheck && cd ../../apps/app && pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/src/profile-status.ts packages/supabase/src/index.ts apps/app/lib/profile/status.ts
git commit -m "refactor: move snobStatus/TIERS into @coffeesnob/supabase"
```

---

### Task 4: Add `@supabase/ssr` and a server-side Supabase client to `apps/web`

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/lib/supabase-server.ts`

- [ ] **Step 1: Add the dependency**

```bash
cd apps/web && pnpm add @supabase/ssr
```

- [ ] **Step 2: Write the server client**

```ts
// apps/web/lib/supabase-server.ts
// Cookie-backed Supabase client for Server Components and Server Actions in the admin
// dashboard (the only part of apps/web that needs a signed-in session — the rest of the
// site is public marketing content read with the plain anon client in lib/supabase.ts).
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@coffeesnob/supabase";

export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render, which can't set cookies — the
            // middleware (Task 5) refreshes the session cookie on every request instead.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/lib/supabase-server.ts
git commit -m "feat: add @supabase/ssr server client for the admin dashboard"
```

(If the lockfile is hoisted to the repo root instead, `git add pnpm-lock.yaml` there rather than under `apps/web/`.)

---

### Task 5: Middleware — gate `/admin/*` on a signed-in admin

**Files:**
- Create: `apps/web/middleware.ts`

- [ ] **Step 1: Write the middleware**

```ts
// apps/web/middleware.ts
// Gates /admin/* on a signed-in user with is_admin = true, per
// docs/superpowers/specs/2026-08-26-map-and-admin-dashboard-design.md ("Next.js middleware
// on the (admin) route group checks the session's is_admin flag and redirects non-admins
// before any admin page renders"). /admin/sign-in is excluded so signing in doesn't loop.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  if (!request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname === "/admin/sign-in") {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/admin/sign-in", request.url));
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/middleware.ts
git commit -m "feat: add admin auth middleware"
```

---

### Task 6: Sign-in page and dashboard shell

**Files:**
- Create: `apps/web/app/(admin)/admin/sign-in/page.tsx`
- Create: `apps/web/app/(admin)/admin/(dashboard)/layout.tsx`
- Create: `apps/web/app/(admin)/admin/(dashboard)/page.tsx`

The `(dashboard)` route group carries the nav shell; `sign-in` sits outside it (as a sibling) so the nav bar never renders on the sign-in page itself. Neither group changes the URL — routes are still `/admin/sign-in` and `/admin`.

- [ ] **Step 1: Write the sign-in page**

```tsx
// apps/web/app/(admin)/admin/sign-in/page.tsx
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase-server";

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/admin/sign-in?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/admin");
}

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="snob-web" style={{ maxWidth: 360, margin: "80px auto", padding: "0 24px" }}>
      <h1 className="d2">Admin sign in</h1>
      {error && (
        <p className="body" style={{ color: "var(--oxblood)", marginTop: 12 }}>
          {error}
        </p>
      )}
      <form action={signIn} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          style={{ height: 46, padding: "0 12px", border: "1px solid var(--rule)", borderRadius: 2 }}
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          style={{ height: 46, padding: "0 12px", border: "1px solid var(--rule)", borderRadius: 2 }}
        />
        <button type="submit" className="btn btn-ox">
          Sign in
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Write the dashboard layout**

```tsx
// apps/web/app/(admin)/admin/(dashboard)/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";

// ponytail: middleware.ts is the sole access-control gate for /admin/* (per
// docs/superpowers/specs/2026-08-26-map-and-admin-dashboard-design.md). This layout is
// UI only — add a server-side re-check here if this ever needs defense-in-depth beyond
// middleware.
export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="snob-web" style={{ minHeight: "100vh" }}>
      <nav style={{ display: "flex", gap: 20, padding: "16px 24px", borderBottom: "1px solid var(--rule)" }}>
        <Link href="/admin" className="label">
          Dashboard
        </Link>
        <Link href="/admin/users" className="label">
          Users
        </Link>
      </nav>
      <main style={{ padding: 24 }}>{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Write a placeholder dashboard home**

```tsx
// apps/web/app/(admin)/admin/(dashboard)/page.tsx
export default function AdminDashboardPage() {
  return <h1 className="d2">Admin dashboard</h1>;
}
```

- [ ] **Step 4: Manual check**

Run: `cd apps/web && pnpm dev`, visit `http://localhost:3000/admin`.
Expected: redirected to `/admin/sign-in` (no session yet). Signing in with a non-admin account redirects to `/`. Signing in with an admin account (none exist yet — see Task 7) lands on `/admin` showing "Admin dashboard" with the nav bar.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(admin)"
git commit -m "feat: add admin sign-in page and dashboard shell"
```

---

### Task 7: Bootstrap the first admin

This can't go in a migration — migrations run in every environment and shouldn't hardcode one person as admin forever, and no admin exists yet to grant the role through the UI (Task 6 has no self-serve path, by design). Run this once, manually, per environment, after signing up that account normally in the Expo app (or via Supabase Auth directly) so its `auth.users`/`profiles` rows exist first.

- [ ] **Step 1: Grant the first admin**

```bash
ADMIN_EMAIL="you@example.com"  # replace with the real account email
psql "$DEV_DATABASE_URL" -c "update public.profiles set is_admin = true where id = (select id from auth.users where email = '$ADMIN_EMAIL')"
```

- [ ] **Step 2: Verify**

```bash
psql "$DEV_DATABASE_URL" -c "select username, is_admin from public.profiles where is_admin = true"
```
Expected: the account you just granted, `is_admin = t`.

Repeat against the production database URL when this ships to production.

---

## Self-review notes

- **Spec coverage:** is_admin/is_admin() ✅ (Task 1), content-table admin RLS ✅ (Task 1), web auth session ✅ (Tasks 4-6), admin route guard ✅ (Task 5). The 2026-08-26 spec's map/Mapbox decisions are a separate, unrelated plan — not touched here.
- **Placeholder scan:** `ADMIN_EMAIL`/`you@example.com` in Task 7 is an operator-supplied value for a manual one-off command, not an unfinished code path — the command itself is complete and runnable.
- **Type consistency:** `is_admin` spelled identically across the migration, `types.ts`, and every RLS policy/query that reads it in this and the next plan.
