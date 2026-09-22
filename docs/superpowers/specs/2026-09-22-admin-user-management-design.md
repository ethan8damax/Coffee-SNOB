# Admin User Management Design

Date: 2026-09-22

## Context

Part of the admin dashboard sub-project tracked in `docs/v1-launch-tracker.md`
("Parish-style HQ patterns", D4). The 2026-08-26 spec
(`2026-08-26-map-and-admin-dashboard-design.md`) already designed
`is_admin`, the `is_admin()` RLS function, and the `(admin)` route group,
but scoped only cities/shops/lists CRUD, a content moderation queue, and a
`partners` table — it never added a page for managing *accounts*. This
fills that gap: a page for the social side of the app (users, their snob
status, and account-level actions like suspension), reusing prior art from
a sibling project's operator back-office (Parish/WayHouse HQ:
tenant-directory + detail-peek + audit pattern) scaled down for a
two-person team with no billing/impersonation needs yet.

Plan tiers (free/pro) are explicitly out of scope — `MONETIZATION.md`
defers "Coffee Snob+" until there's an audience, so there is nothing to
track yet. `is_admin` is a staff-access role, not a plan.

## Decisions

**Where it lives:** `apps/web/app/(admin)/admin/users` — same route group,
Supabase client, and design tokens as the rest of the admin dashboard (no
separate visual dialect).

**Schema:**
- `profiles.is_admin boolean not null default false` — this is the first
  migration that actually adds the column the 2026-08-26 spec designed.
- `profiles.status text not null default 'active' check (status in
  ('active','suspended'))` — new.
- `admin_actions` table: `id, actor_id, target_user_id, action text,
  created_at`. One shared audit table for both actions below — not a full
  audit-log subsystem, just "who did what to whom."

**Suspension enforcement:** a suspended user can still sign in and read
(sees a "your account is restricted" banner) but can't write. RLS insert
policies on `logs`, `follows`, `list_saves`, `log_likes`, `comments`,
`comment_likes` each add `and (select status from profiles where id =
auth.uid()) = 'active'`. One clause, applied everywhere a user can currently
write, so a suspended account can't route around it through a table this
list missed.

**List page:** search by username; filter chips (All / Admins /
Suspended); sortable table with avatar, username, joined date, snob tier
(already computed from log count per the existing tier thresholds — just
displayed, no new computation), log count, follower count, status.

**Detail view:** a side peek (not a separate route) showing profile info,
stats, and recent activity (logs/comments), with two actions:
- **Suspend / Reactivate** — flips `profiles.status`, writes an
  `admin_actions` row.
- **Grant / Revoke admin** — flips `profiles.is_admin`, writes an
  `admin_actions` row. Only an existing admin can do this (enforced by the
  same `is_admin()` RLS check that gates the rest of the admin surface).

## Explicitly out of scope

- **Impersonation / "view as user"** — no support-ticket volume yet to
  justify it. Revisit if manual Supabase debugging becomes frequent.
- **Bulk actions** — table is small at current scale.
- **Plan tiers** — nothing to track until Coffee Snob+ ships (see Context).
- **Fraud/security detection** — suspend covers abuse response for now;
  no automated detection to build against.

## Testing

- RLS test: a suspended user's insert to each of the six tables above is
  rejected; an active user's insert succeeds.
- RLS test: only `is_admin = true` profiles can update another profile's
  `is_admin` or `status`.
