# Admin User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/admin/users` page from `docs/superpowers/specs/2026-09-22-admin-user-management-design.md` — search/filter the user directory, view a user's activity and snob tier, and suspend/reactivate or grant/revoke admin, with every action audited.

**Architecture:** A `security_invoker` view (`admin_user_directory`, same pattern as `shop_ratings`) does the log/follower-count aggregation in one query instead of one round-trip per row. Two mutations (`setUserStatus`, `setUserAdmin`) each write the profile change and an `admin_actions` audit row. The page itself needs no client-side JavaScript — the detail view is a `?user=<id>` query param the server reads and renders conditionally, and actions are plain Server Actions on `<form>` elements, matching this app's existing server-rendered pattern.

**Tech Stack:** Postgres/Supabase (migration, RLS restrictive policies, `security_invoker` view), `@coffeesnob/supabase` (typed queries), Next.js Server Actions, Vitest.

**Depends on:** `2026-09-22-admin-dashboard-foundation.md` (must be done first — this plan uses `is_admin()`, the admin route group, and the server Supabase client it creates).

---

### Task 1: Migration — `status`, `admin_actions`, suspension enforcement, and the user directory view

**Files:**
- Create: `supabase/migrations/0019_admin_user_management.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Admin user management (see docs/superpowers/specs/2026-09-22-admin-user-management-design.md).
-- Adds account status + an audit trail for admin actions, enforces that only an admin can
-- change is_admin/status on any profile (including their own), blocks a suspended user from
-- writing anywhere a normal user currently can, and adds the aggregated view the admin users
-- list reads from (same security_invoker pattern as 0010_shop_ratings_view.sql).

alter table public.profiles add column status text not null default 'active' check (status in ('active', 'suspended'));

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_actions enable row level security;
create policy "admins read admin_actions" on public.admin_actions for select using (public.is_admin());
create policy "admins insert admin_actions" on public.admin_actions for insert with check (public.is_admin() and actor_id = auth.uid());

-- The existing "users update their own profile" policy (using auth.uid() = id, no column
-- restriction) would otherwise let any user grant themselves admin or un-suspend themselves
-- via a normal profile update. A trigger is used because RLS policies can't restrict which
-- *columns* a row-level check applies to — only a trigger can compare NEW/OLD per column.
create or replace function public.protect_privileged_profile_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.is_admin is distinct from old.is_admin or new.status is distinct from old.status)
     and not public.is_admin() then
    raise exception 'only an admin can change is_admin or status';
  end if;
  return new;
end;
$$;

create trigger protect_privileged_profile_columns_trigger
  before update on public.profiles
  for each row execute function public.protect_privileged_profile_columns();

-- Lets an admin update someone ELSE's row at all — the existing policy only allows
-- auth.uid() = id, so without this an admin could never suspend another account.
create policy "admins update any profile" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- Suspension enforcement. These are RESTRICTIVE policies, which Postgres ANDs with every
-- existing PERMISSIVE policy on the same command (the "users manage their own X" policies
-- already on these tables) rather than OR-ing like a second permissive policy would — a
-- second permissive policy here would add another way to pass, not narrow anything. One
-- restrictive policy per table is all it takes to require status = 'active' regardless of
-- what the permissive policies already allow.
create policy "must be active to insert" on public.logs as restrictive for insert
  with check ((select status from public.profiles where id = auth.uid()) = 'active');
create policy "must be active to insert" on public.follows as restrictive for insert
  with check ((select status from public.profiles where id = auth.uid()) = 'active');
create policy "must be active to insert" on public.list_saves as restrictive for insert
  with check ((select status from public.profiles where id = auth.uid()) = 'active');
create policy "must be active to insert" on public.log_likes as restrictive for insert
  with check ((select status from public.profiles where id = auth.uid()) = 'active');
create policy "must be active to insert" on public.comments as restrictive for insert
  with check ((select status from public.profiles where id = auth.uid()) = 'active');
create policy "must be active to insert" on public.comment_likes as restrictive for insert
  with check ((select status from public.profiles where id = auth.uid()) = 'active');

-- The admin users list: one row per profile with log/follower counts aggregated, instead of
-- one count query per row. security_invoker = true means it runs under the caller's own
-- privileges — but profiles has a public read policy, so without the explicit is_admin()
-- guard below, any signed-in (or anonymous) user could read this view directly. The guard
-- makes it return zero rows for anyone who isn't an admin, regardless of table-level policies.
create view public.admin_user_directory
with (security_invoker = true)
as
select
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.is_admin,
  p.status,
  p.created_at,
  count(distinct l.id) as log_count,
  count(distinct f.follower_id) as follower_count
from public.profiles p
left join public.logs l on l.user_id = p.id
left join public.follows f on f.followee_id = p.id
where public.is_admin()
group by p.id;
```

- [ ] **Step 2: Apply the migration and verify structure**

Run: `psql "$DEV_DATABASE_URL" -f supabase/migrations/0019_admin_user_management.sql`

```bash
psql "$DEV_DATABASE_URL" -c "\d public.profiles" -c "\d public.admin_actions"
psql "$DEV_DATABASE_URL" -c "select policyname, permissive from pg_policies where tablename = 'logs'"
```
Expected: `profiles` shows `status` (text, not null, default `'active'`) and the `protect_privileged_profile_columns_trigger` trigger; `admin_actions` exists with the columns above; the `logs` policy list includes `must be active to insert` with `permissive = f`.

- [ ] **Step 3: Verify the privileged-column trigger blocks self-promotion**

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
    update public.profiles set is_admin = true where id = v_user_id;
    raise exception 'expected self-promotion to be rejected';
  exception when others then
    raise notice 'self-promotion correctly rejected: %', sqlerrm;
  end;
  reset role;
end $$;
SQL
```
Expected: `NOTICE: self-promotion correctly rejected: only an admin can change is_admin or status`.

- [ ] **Step 4: Verify suspension blocks a log insert**

```bash
psql "$DEV_DATABASE_URL" <<'SQL'
do $$
declare
  v_user_id uuid;
  v_shop_id uuid;
begin
  select id into v_user_id from auth.users limit 1;
  insert into public.shops (name) values ('Suspension Test Shop') returning id into v_shop_id;
  update public.profiles set status = 'suspended' where id = v_user_id;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_id)::text, true);
  set local role authenticated;
  begin
    insert into public.logs (user_id, shop_id, rating) values (v_user_id, v_shop_id, 5);
    raise exception 'expected suspended insert to be rejected';
  exception when others then
    raise notice 'suspended insert correctly rejected: %', sqlerrm;
  end;
  reset role;
  update public.profiles set status = 'active' where id = v_user_id;
  delete from public.shops where id = v_shop_id;
end $$;
SQL
```
Expected: `NOTICE: suspended insert correctly rejected: ...`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0019_admin_user_management.sql
git commit -m "feat: add profile status, admin_actions, suspension RLS, admin_user_directory view"
```

---

### Task 2: Update `packages/supabase/src/types.ts`

**Files:**
- Modify: `packages/supabase/src/types.ts` (`profiles` table, new `admin_actions` table, new `admin_user_directory` view)

- [ ] **Step 1: Add `status` to the `profiles` type**

In the `profiles` entry (already edited by the foundation plan to include `is_admin`), add `status` between `onboarded_at` and `taste_picks` in all three of `Row`, `Insert`, `Update`:

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
          status: string
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
          status?: string
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
          status?: string
          taste_picks?: string[]
          username?: string
        }
        Relationships: []
      }
```

- [ ] **Step 2: Add the `admin_actions` table type**

Add this entry alongside the other `Tables` entries (e.g. right after `profiles`):

```ts
      admin_actions: {
        Row: {
          id: string
          actor_id: string
          target_user_id: string
          action: string
          created_at: string
        }
        Insert: {
          id?: string
          actor_id: string
          target_user_id: string
          action: string
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string
          target_user_id?: string
          action?: string
          created_at?: string
        }
        Relationships: []
      }
```

- [ ] **Step 3: Add the `admin_user_directory` view type**

In the `Views` object, alongside `shop_ratings`:

```ts
      admin_user_directory: {
        Row: {
          id: string
          username: string
          display_name: string | null
          avatar_url: string | null
          is_admin: boolean
          status: string
          created_at: string
          log_count: number
          follower_count: number
        }
        Relationships: []
      }
```

- [ ] **Step 4: Typecheck**

Run: `cd packages/supabase && pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/src/types.ts
git commit -m "feat: add status, admin_actions, admin_user_directory to generated types"
```

---

### Task 3: Query functions — `getAdminUserDirectory`, `setUserStatus`, `setUserAdmin`

**Files:**
- Modify: `packages/supabase/src/queries.ts`
- Modify: `packages/supabase/src/index.ts`
- Modify: `packages/supabase/test/queries.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the top-level import list in `packages/supabase/test/queries.test.ts`:
```ts
import { getAdminUserDirectory, setUserStatus, setUserAdmin } from "../src/queries";
```

Append these `describe` blocks:
```ts
describe("getAdminUserDirectory", () => {
  function fakeDirectoryClient(rows: unknown[]) {
    const builder: any = {
      select: () => builder,
      order: () => builder,
      ilike: () => builder,
      eq: () => builder,
      then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: rows, error: null }),
    };
    return { from: () => builder } as any;
  }

  it("maps view rows to AdminUserRow", async () => {
    const client = fakeDirectoryClient([
      {
        id: "u1",
        username: "mara",
        display_name: "Mara K.",
        avatar_url: null,
        is_admin: false,
        status: "active",
        created_at: "2026-01-01T00:00:00Z",
        log_count: 12,
        follower_count: 3,
      },
    ]);
    const rows = await getAdminUserDirectory(client);
    expect(rows).toEqual([
      {
        id: "u1",
        username: "mara",
        displayName: "Mara K.",
        avatarUrl: null,
        isAdmin: false,
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
        logCount: 12,
        followerCount: 3,
      },
    ]);
  });

  it("throws when the client returns an error", async () => {
    const client = {
      from: () => ({
        select: () => ({
          order: () => ({ then: (resolve: any) => resolve({ data: null, error: new Error("boom") }) }),
        }),
      }),
    } as any;
    await expect(getAdminUserDirectory(client)).rejects.toThrow("boom");
  });
});

describe("setUserStatus", () => {
  it("updates the profile and writes an admin_actions row", async () => {
    const calls: { table: string; op: string; payload?: unknown }[] = [];
    const client = {
      from: (table: string) => ({
        update: (payload: unknown) => {
          calls.push({ table, op: "update", payload });
          return { eq: () => Promise.resolve({ error: null }) };
        },
        insert: (payload: unknown) => {
          calls.push({ table, op: "insert", payload });
          return Promise.resolve({ error: null });
        },
      }),
    } as any;
    await setUserStatus(client, "admin-1", "target-1", "suspended");
    expect(calls).toEqual([
      { table: "profiles", op: "update", payload: { status: "suspended" } },
      { table: "admin_actions", op: "insert", payload: { actor_id: "admin-1", target_user_id: "target-1", action: "suspend" } },
    ]);
  });
});

describe("setUserAdmin", () => {
  it("updates the profile and writes an admin_actions row", async () => {
    const calls: { table: string; op: string; payload?: unknown }[] = [];
    const client = {
      from: (table: string) => ({
        update: (payload: unknown) => {
          calls.push({ table, op: "update", payload });
          return { eq: () => Promise.resolve({ error: null }) };
        },
        insert: (payload: unknown) => {
          calls.push({ table, op: "insert", payload });
          return Promise.resolve({ error: null });
        },
      }),
    } as any;
    await setUserAdmin(client, "admin-1", "target-1", true);
    expect(calls).toEqual([
      { table: "profiles", op: "update", payload: { is_admin: true } },
      { table: "admin_actions", op: "insert", payload: { actor_id: "admin-1", target_user_id: "target-1", action: "grant_admin" } },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/supabase && pnpm test`
Expected: FAIL — `getAdminUserDirectory`/`setUserStatus`/`setUserAdmin` are not exported from `../src/queries`.

- [ ] **Step 3: Implement the functions**

Add to `packages/supabase/src/queries.ts`, near `searchProfiles`:

```ts
export type AdminUserRow = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  status: string;
  createdAt: string;
  logCount: number;
  followerCount: number;
};

export async function getAdminUserDirectory(
  client: Client,
  opts?: { search?: string; filter?: "all" | "admins" | "suspended" }
): Promise<AdminUserRow[]> {
  let query = client.from("admin_user_directory").select("*").order("created_at", { ascending: false });
  const q = opts?.search?.trim().toLowerCase().replace(/[%_\\]/g, "");
  if (q) query = query.ilike("username", `%${q}%`);
  if (opts?.filter === "admins") query = query.eq("is_admin", true);
  if (opts?.filter === "suspended") query = query.eq("status", "suspended");
  const { data, error } = await query;
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    isAdmin: r.is_admin,
    status: r.status,
    createdAt: r.created_at,
    logCount: r.log_count,
    followerCount: r.follower_count,
  }));
}

// actorId is the signed-in admin performing the action (from auth.getUser() at the call
// site) — never trust a client-supplied actor id, but this function itself is transport-
// agnostic, so it just takes the value the caller already verified.
export async function setUserStatus(
  client: Client,
  actorId: string,
  targetUserId: string,
  status: "active" | "suspended"
): Promise<void> {
  const { error } = await client.from("profiles").update({ status }).eq("id", targetUserId);
  if (error) throw error;
  const { error: actionError } = await client
    .from("admin_actions")
    .insert({ actor_id: actorId, target_user_id: targetUserId, action: status === "suspended" ? "suspend" : "reactivate" });
  if (actionError) throw actionError;
}

export async function setUserAdmin(client: Client, actorId: string, targetUserId: string, isAdmin: boolean): Promise<void> {
  const { error } = await client.from("profiles").update({ is_admin: isAdmin }).eq("id", targetUserId);
  if (error) throw error;
  const { error: actionError } = await client
    .from("admin_actions")
    .insert({ actor_id: actorId, target_user_id: targetUserId, action: isAdmin ? "grant_admin" : "revoke_admin" });
  if (actionError) throw actionError;
}
```

- [ ] **Step 4: Export the new type and functions**

In `packages/supabase/src/index.ts`, add `getAdminUserDirectory, setUserStatus, setUserAdmin` to the existing `export { ... } from "./queries"` list, and add:
```ts
export type { AdminUserRow } from "./queries";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/supabase && pnpm test`
Expected: PASS, all suites green.

- [ ] **Step 6: Commit**

```bash
git add packages/supabase/src/queries.ts packages/supabase/src/index.ts packages/supabase/test/queries.test.ts
git commit -m "feat: add getAdminUserDirectory, setUserStatus, setUserAdmin"
```

---

### Task 4: The `/admin/users` page

**Files:**
- Create: `apps/web/app/(admin)/admin/(dashboard)/users/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// apps/web/app/(admin)/admin/(dashboard)/users/page.tsx
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getAdminUserDirectory, getProfileEntries, setUserStatus, setUserAdmin, snobStatus } from "@coffeesnob/supabase";

async function suspendAction(formData: FormData) {
  "use server";
  const targetUserId = String(formData.get("targetUserId"));
  const nextStatus = formData.get("nextStatus") === "suspended" ? "suspended" : "active";
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await setUserStatus(supabase, user.id, targetUserId, nextStatus);
  revalidatePath("/admin/users");
}

async function adminAction(formData: FormData) {
  "use server";
  const targetUserId = String(formData.get("targetUserId"));
  const nextIsAdmin = formData.get("nextIsAdmin") === "true";
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await setUserAdmin(supabase, user.id, targetUserId, nextIsAdmin);
  revalidatePath("/admin/users");
}

type Filter = "all" | "admins" | "suspended";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; filter?: Filter; user?: string }>;
}) {
  const { search, filter = "all", user: selectedUserId } = await searchParams;
  const supabase = await getSupabaseServer();
  const users = await getAdminUserDirectory(supabase, { search, filter });

  const selectedUser = selectedUserId ? users.find((u) => u.id === selectedUserId) : undefined;
  const selectedUserLogs = selectedUser ? await getProfileEntries(supabase, selectedUser.id, { limit: 10 }) : [];

  return (
    <div>
      <h1 className="d2">Users</h1>

      <form style={{ display: "flex", gap: 12, margin: "16px 0", alignItems: "center" }}>
        <input type="hidden" name="filter" value={filter} />
        <input
          name="search"
          defaultValue={search}
          placeholder="Search username"
          style={{ height: 38, padding: "0 10px", border: "1px solid var(--rule)", borderRadius: 2 }}
        />
        <button type="submit" className="btn btn-line">
          Search
        </button>
        {(["all", "admins", "suspended"] as const).map((f) => (
          <Link key={f} href={`/admin/users?filter=${f}`} className={`chip ${filter === f ? "on" : ""}`}>
            {f}
          </Link>
        ))}
      </form>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)" }}>
            <th>Username</th>
            <th>Joined</th>
            <th>Snob tier</th>
            <th>Logs</th>
            <th>Followers</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid var(--rule)" }}>
              <td>
                {u.username}
                {u.isAdmin ? " · admin" : ""}
              </td>
              <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              <td>{snobStatus(u.logCount).name}</td>
              <td>{u.logCount}</td>
              <td>{u.followerCount}</td>
              <td>{u.status}</td>
              <td>
                <Link href={`/admin/users?filter=${filter}&user=${u.id}`} className="label">
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedUser && (
        <aside
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: 360,
            background: "var(--paper)",
            borderLeft: "1px solid var(--rule)",
            padding: 24,
            overflowY: "auto",
          }}
        >
          <Link href={`/admin/users?filter=${filter}`} className="label">
            Close
          </Link>
          <h2 className="d3" style={{ marginTop: 16 }}>
            {selectedUser.username}
          </h2>
          <p className="body">Joined {new Date(selectedUser.createdAt).toLocaleDateString()}</p>
          <p className="body">
            {snobStatus(selectedUser.logCount).name} · {selectedUser.logCount} logs · {selectedUser.followerCount} followers
          </p>
          <p className="body">Status: {selectedUser.status}</p>

          <form action={suspendAction} style={{ marginTop: 16 }}>
            <input type="hidden" name="targetUserId" value={selectedUser.id} />
            <input type="hidden" name="nextStatus" value={selectedUser.status === "active" ? "suspended" : "active"} />
            <button type="submit" className="btn btn-line">
              {selectedUser.status === "active" ? "Suspend" : "Reactivate"}
            </button>
          </form>

          <form action={adminAction} style={{ marginTop: 8 }}>
            <input type="hidden" name="targetUserId" value={selectedUser.id} />
            <input type="hidden" name="nextIsAdmin" value={(!selectedUser.isAdmin).toString()} />
            <button type="submit" className="btn btn-line">
              {selectedUser.isAdmin ? "Revoke admin" : "Grant admin"}
            </button>
          </form>

          <h3 className="d4" style={{ marginTop: 24 }}>
            Recent activity
          </h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {selectedUserLogs.map((entry) => (
              <li key={entry.id} className="body-sm" style={{ borderBottom: "1px solid var(--rule)", padding: "8px 0" }}>
                {entry.shopName} · {entry.rating}★ · {entry.visitedAt}
              </li>
            ))}
            {selectedUserLogs.length === 0 && <li className="body-sm">No activity yet.</li>}
          </ul>
        </aside>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Manual check**

Run: `cd apps/web && pnpm dev`, sign in as the admin bootstrapped in the foundation plan, visit `/admin/users`.
Expected: table of users loads; searching filters by username; the `admins`/`suspended` chips filter; clicking "View" opens the side panel with recent activity; clicking "Suspend" flips the row's status and closes back to the list (via `revalidatePath`); suspending, then trying to log a visit as that user in the Expo app, is rejected (confirms Task 1's RLS end-to-end).

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(admin)/admin/(dashboard)/users"
git commit -m "feat: add admin users page (search, filter, suspend, grant admin)"
```

---

## Self-review notes

- **Spec coverage:** search/filter/list ✅, side-peek detail with recent activity ✅, suspend/reactivate ✅, grant/revoke admin ✅, audit trail ✅ (Task 1's `admin_actions`), suspension enforcement across all six write tables ✅ (Task 1's restrictive policies). Impersonation, bulk actions, and plan tiers are explicitly out of scope per the spec — nothing here builds toward them.
- **Placeholder scan:** none found.
- **Type consistency:** `AdminUserRow` field names match between `queries.ts` and the page (`displayName`, `avatarUrl`, `isAdmin`, `logCount`, `followerCount`, `createdAt` throughout — no `snake_case`/`camelCase` mismatches). `setUserStatus`/`setUserAdmin`'s `action` string values (`"suspend"`/`"reactivate"`/`"grant_admin"`/`"revoke_admin"`) are free-text in `admin_actions.action` (not an enum) — fine for an audit log read by humans, not matched against in code anywhere.
