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
  action text not null check (action in ('suspend', 'reactivate', 'grant_admin', 'revoke_admin')),
  created_at timestamptz not null default now()
);

alter table public.admin_actions enable row level security;
create policy "admins read admin_actions" on public.admin_actions for select using (public.is_admin());
create policy "admins insert admin_actions" on public.admin_actions for insert with check (public.is_admin() and actor_id = auth.uid());

-- Companion to is_admin() (0018) for the suspension checks below — same shape, same
-- non-security-definer posture (profiles is public-read, so no elevated privilege needed).
create or replace function public.is_active()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((select status from public.profiles where id = auth.uid()) = 'active', false);
$$;

-- The existing "users update their own profile" policy (using auth.uid() = id, no column
-- restriction) would otherwise let any user grant themselves admin or un-suspend themselves
-- via a normal profile update. A trigger is used because RLS policies can't restrict which
-- *columns* a row-level check applies to — only a trigger can compare NEW/OLD per column.
--
-- Operational note: triggers fire for every role, including service_role/a raw superuser
-- session with no request.jwt.claims set — unlike RLS, there's no bypass-for-privileged-
-- roles equivalent. That means auth.uid() is null and is_admin() is false in that context,
-- so even a trusted service-role script hits "only an admin can change is_admin or status"
-- on a bare UPDATE. This is intentional (no path, authenticated or not, flips these columns
-- without an admin actor) — but a future ops script that needs to bulk-update either column
-- must wrap the statement in `set local session_replication_role = replica;` (skips normal
-- triggers) or `alter table profiles disable/enable trigger
-- protect_privileged_profile_columns_trigger` around it, rather than assuming service_role
-- alone is enough, the way it is everywhere else in this schema.
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
  with check (public.is_active());
create policy "must be active to insert" on public.follows as restrictive for insert
  with check (public.is_active());
create policy "must be active to insert" on public.list_saves as restrictive for insert
  with check (public.is_active());
create policy "must be active to insert" on public.log_likes as restrictive for insert
  with check (public.is_active());
create policy "must be active to insert" on public.comments as restrictive for insert
  with check (public.is_active());
create policy "must be active to insert" on public.comment_likes as restrictive for insert
  with check (public.is_active());

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

-- log_shop_visit is security definer, so it runs with the function owner's privileges and
-- bypasses RLS entirely — including the restrictive "must be active to insert" policy on
-- logs above. Since this RPC (not a direct table insert) is the app's actual write path for
-- logging a visit (packages/supabase/src/queries.ts's logVisit calls it with all 12 params),
-- the restrictive policy alone would leave suspension unenforced for the one write it's meant
-- to block.
--
-- IMPORTANT: the live signature is the 12-arg one from 0015_v1_log_drink_shop_details_profile
-- _bio.sql, not the original 7-arg one from 0011_log_shop_visit.sql — 0015 deliberately DROPPED
-- the 7-arg overload and replaced it (different params, different return type: table(shop_id,
-- log_id) instead of public.logs) specifically to avoid PostgREST overload ambiguity. A first
-- pass at this patch mistakenly recreated the dead 7-arg signature instead, which (a) didn't
-- touch the overload the app actually calls, leaving the suspension bypass wide open, and
-- (b) resurrected the exact ambiguity 0015 removed. Copying 0015's body verbatim here, plus
-- one added status check up front, same pattern as its existing "must be authenticated" check.
create or replace function public.log_shop_visit(
  p_external_id text,
  p_name text,
  p_lat double precision,
  p_lng double precision,
  p_rating smallint,
  p_note text default null,
  p_visited_at date default current_date,
  p_drink text default null,
  p_address text default null,
  p_website text default null,
  p_phone text default null,
  p_hours text default null
)
returns table (shop_id uuid, log_id uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_shop_id uuid;
  v_log_id uuid;
  v_website text := nullif(btrim(p_website), '');
begin
  if auth.uid() is null then
    raise exception 'must be authenticated to log a visit';
  end if;

  if not public.is_active() then
    raise exception 'account is suspended';
  end if;

  -- Not an http(s) URL -> store nothing rather than fail the whole log.
  if v_website is not null and v_website !~* '^https?://' then
    v_website := null;
  end if;

  -- external_id's unique index (0008_shop_curations.sql) is partial
  -- (where external_id is not null), so the arbiter predicate must be
  -- repeated here or Postgres can't infer it as the conflict target.
  -- On a repeat log the detail columns are only filled where still null
  -- (never overwritten), so earlier data wins.
  insert into public.shops (external_id, name, lat, lng, address, website, phone, hours)
  values (
    p_external_id,
    p_name,
    p_lat,
    p_lng,
    left(nullif(btrim(p_address), ''), 300),
    left(v_website, 500),
    left(nullif(btrim(p_phone), ''), 50),
    left(nullif(btrim(p_hours), ''), 500)
  )
  -- The shop's name is NOT updated on conflict: any signed-in user can call this RPC, so
  -- letting a repeat log overwrite the name would let anyone rename an existing shop.
  on conflict (external_id) where external_id is not null do update set
    address = coalesce(shops.address, excluded.address),
    website = coalesce(shops.website, excluded.website),
    phone   = coalesce(shops.phone,   excluded.phone),
    hours   = coalesce(shops.hours,   excluded.hours)
  returning id into v_shop_id;

  insert into public.logs (user_id, shop_id, rating, note, drink, visited_at)
  values (
    auth.uid(),
    v_shop_id,
    p_rating,
    left(p_note, 500),
    left(nullif(btrim(p_drink), ''), 40),
    coalesce(p_visited_at, current_date)
  )
  returning id into v_log_id;

  return query select v_shop_id, v_log_id;
end;
$$;

-- The mistaken first pass (see comment above) created a stray 7-arg overload that doesn't
-- exist anywhere else in the schema's history from this point forward — drop it so it can't
-- shadow/ambiguate calls the way 0015 already worked to prevent.
drop function if exists public.log_shop_visit(text, text, double precision, double precision, smallint, text, date);
