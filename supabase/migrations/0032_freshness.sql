-- Curation Phase 6: freshness
-- (docs/superpowers/specs/2026-09-27-curation-phase-6-freshness-design.md).

-- ── Possibly closed: the admin's call on a rated shop the sources lost ──
alter table public.shops
  add column closed_at timestamptz,
  add column open_checked_at timestamptz;

-- Closed shops leave the map and city pages; their logs stay on profiles.
-- (Body as 0026, plus the closed_at filter.)
create or replace view public.shop_ratings with (security_invoker = true) as
  select s.id,
    s.name,
    s.lat,
    s.lng,
    s.city_id,
    s.neighborhood,
    sc.shop_id is not null as is_snob_approved,
    sc.tag,
    sc.price_tier,
    coalesce(sc.editorial_rating, round(avg(l.rating))::smallint) as rating,
    count(l.id) as log_count,
    s.external_id,
    s.locality,
    s.region,
    s.country_code,
    s.city_key
  from shops s
    left join shop_curations sc on sc.shop_id = s.id
    left join logs l on l.shop_id = s.id
  where not public.is_chain_name(s.name) and s.closed_at is null
  group by s.id, sc.shop_id, sc.tag, sc.price_tier, sc.editorial_rating
  having sc.shop_id is not null or count(l.id) > 0;

-- ── Credit the finder ────────────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('snob_approved')),
  shop_id uuid not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, kind, shop_id)
);
create index notifications_shop_idx on public.notifications (shop_id);

alter table public.notifications enable row level security;
create policy "users read their own notifications" on public.notifications
  for select using (user_id = (select auth.uid()));
create policy "users mark their own notifications read" on public.notifications
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Marking read is the only change a user can make.
revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Snob-Approval tells whoever logged the shop first.
create or replace function public.notify_shop_finder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, kind, shop_id)
  select l.user_id, 'snob_approved', new.shop_id
  from public.logs l
  where l.shop_id = new.shop_id
  order by l.created_at
  limit 1
  on conflict (user_id, kind, shop_id) do nothing;
  return null;
end;
$$;

create trigger on_curation_notify_finder
  after insert on public.shop_curations
  for each row execute function public.notify_shop_finder();

revoke all on function public.notify_shop_finder() from public, anon, authenticated;
