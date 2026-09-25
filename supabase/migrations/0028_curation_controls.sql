-- Curation Phase 3 (docs/superpowers/specs/2026-09-25-curation-phase-3-controls-design.md):
-- chain decisions, per-place overrides, and user reports on coffee index places.

-- ── Chains: blocked or allowed, and optional prefix matching ────────────
-- 'allowed' records a "not a chain" decision so the build stops suggesting it.
-- prefix: an entry with a brand ID that an admin chose to also match leading
-- words ("Starbucks Gig Harbor"), never set automatically.
alter table public.chain_blocklist
  add column status text not null default 'blocked' check (status in ('blocked', 'allowed')),
  add column prefix boolean not null default false;

-- Mirror of normalizeChainName / isChain in packages/coffee-index/src/index.ts
-- (test/chain-twins.test.ts). Only blocked rows count.
create or replace function public.is_chain_name(p_name text)
returns boolean
language sql
stable
set search_path = public
as $$
  with n as (
    select btrim(regexp_replace(
      replace(replace(
        translate(lower(coalesce(p_name, '')), 'áàâäãåéèêëíìîïóòôöõúùûüñç', 'aaaaaaeeeeiiiiooooouuuunc'),
      '''', ''), '’', ''),
      '[\s!-/:-@\[-`{-~ ·‐-‧　-〿・！-／：-＠]+', ' ', 'g')) as v
  )
  select exists (
    select 1 from public.chain_blocklist b, n
    where b.status = 'blocked'
      and (n.v = b.name or ((b.wikidata is null or b.prefix) and n.v like b.name || ' %'))
  );
$$;

-- ── Overrides: an admin's show/hide call on one index place ─────────────
create table public.place_overrides (
  place_id text primary key check (place_id ~ '^cs_[0-9a-f]{12}$'),
  action text not null check (action in ('show', 'hide')),
  reason text check (char_length(reason) <= 500),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.place_overrides enable row level security;
create policy "place overrides are publicly readable" on public.place_overrides for select using (true);
create policy "admins insert place_overrides" on public.place_overrides for insert with check (public.is_admin());
create policy "admins update place_overrides" on public.place_overrides for update using (public.is_admin()) with check (public.is_admin());
create policy "admins delete place_overrides" on public.place_overrides for delete using (public.is_admin());

-- ── Flags: user reports on index places ─────────────────────────────────
-- Name and position are copied in at report time so the admin can see what
-- was reported without loading the index.
create table public.place_flags (
  id uuid primary key default gen_random_uuid(),
  place_id text not null check (place_id ~ '^cs_[0-9a-f]{12}$'),
  place_name text not null check (char_length(place_name) between 1 and 200),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('closed', 'not_specialty', 'wrong_location')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (place_id, user_id, kind)
);

create index place_flags_open_idx on public.place_flags (place_id) where resolved_at is null;
create index place_flags_user_idx on public.place_flags (user_id, created_at);

alter table public.place_flags enable row level security;
create policy "users see their own flags, admins see all" on public.place_flags for select
  using (user_id = (select auth.uid()) or public.is_admin());
create policy "active users flag places" on public.place_flags for insert
  with check (user_id = (select auth.uid()) and public.is_active());
create policy "admins resolve flags" on public.place_flags for update using (public.is_admin()) with check (public.is_admin());

-- At most 20 reports per user per day.
create or replace function public.limit_place_flags()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.place_flags
      where user_id = new.user_id and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'Too many reports today' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_place_flags() from public, anon, authenticated;

create trigger place_flags_rate_limit before insert on public.place_flags
  for each row execute function public.limit_place_flags();

-- ── Read functions for the app and the monthly build ────────────────────
-- Security definer so anyone gets the answer without seeing who reported what.

-- Places hidden right now: hide overrides, and places two different users
-- reported closed (until an admin resolves those reports).
create or replace function public.active_place_hides()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select place_id from public.place_overrides where action = 'hide'
  union
  select place_id from public.place_flags
  where kind = 'closed' and resolved_at is null
  group by place_id having count(distinct user_id) >= 2;
$$;

-- Per place: how many different users call it "not specialty" (open reports).
create or replace function public.place_flag_counts()
returns table (place_id text, not_specialty integer)
language sql
stable
security definer
set search_path = public
as $$
  select place_id, count(distinct user_id)::integer
  from public.place_flags
  where kind = 'not_specialty' and resolved_at is null
  group by place_id;
$$;

revoke all on function public.active_place_hides() from public;
revoke all on function public.place_flag_counts() from public;
grant execute on function public.active_place_hides() to anon, authenticated;
grant execute on function public.place_flag_counts() to anon, authenticated;
