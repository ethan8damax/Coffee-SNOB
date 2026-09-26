-- Curation Phase 4: clout, an admin-only signal
-- (docs/superpowers/specs/2026-09-26-curation-phase-4-clout-design.md).
-- Users still see only the 5-level effort rating. Clout tells the admin
-- which shops are collecting strong ratings from enough different people to
-- deserve a visit, and replaces 0009's fixed "5 logs averaging 4.2" trigger.

create table public.shop_clout (
  shop_id uuid primary key references public.shops (id) on delete cascade,
  loggers integer not null,          -- distinct people, 7+ day old accounts
  adjusted numeric(4, 2) not null,   -- rating shrunk toward the global mean
  first_log_at timestamptz not null, -- CURATION-STANDARDS: wait 90 days
  last_log_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.shop_clout enable row level security;
create policy "admins read shop_clout" on public.shop_clout for select using (public.is_admin());

-- The two-visit checklist before Snob-Approval.
create table public.curation_visits (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  visited_on date not null default current_date,
  visited_by uuid references public.profiles (id) on delete set null default auth.uid(),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);
create index curation_visits_shop_idx on public.curation_visits (shop_id, visited_on);
create index curation_visits_visited_by_idx on public.curation_visits (visited_by);

alter table public.curation_visits enable row level security;
create policy "admins read curation_visits" on public.curation_visits for select using (public.is_admin());
create policy "admins insert curation_visits" on public.curation_visits for insert with check (public.is_admin());
create policy "admins delete curation_visits" on public.curation_visits for delete using (public.is_admin());

-- Recomputes one shop's clout, and flags it for a visit when it clears the
-- bar. Named constants: raising the bar is a one-line migration.
create or replace function public.recompute_shop_clout(p_shop_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prior constant numeric := 5;          -- ratings worth of "average" every shop starts with
  v_min_loggers constant integer := 5;
  v_min_adjusted constant numeric := 4.2;
  v_new_account constant interval := interval '7 days';
  v_stale constant interval := interval '18 months';
  v_mean numeric;
  v_loggers integer;
  v_weight numeric;
  v_sum numeric;
  v_first timestamptz;
  v_last timestamptz;
  v_adjusted numeric;
begin
  select min(created_at), max(created_at) into v_first, v_last from public.logs where shop_id = p_shop_id;
  if v_first is null then
    delete from public.shop_clout where shop_id = p_shop_id;
    return;
  end if;

  -- ponytail: the global mean is recomputed on every log write, a scan of all
  -- logs. Ceiling: fine to ~100k logs. Upgrade path: a one-row table
  -- refreshed nightly by pg_cron.
  select coalesce(avg(rating), 3) into v_mean
  from (
    select distinct on (l.shop_id, l.user_id) l.rating
    from public.logs l
    join public.profiles p on p.id = l.user_id
    where p.created_at <= now() - v_new_account
    order by l.shop_id, l.user_id, l.visited_at desc, l.created_at desc
  ) latest;

  -- Each person once (their latest log here); old visits count half.
  select count(*),
    coalesce(sum(w), 0),
    coalesce(sum(rating * w), 0)
  into v_loggers, v_weight, v_sum
  from (
    select distinct on (l.user_id)
      l.rating,
      case when l.visited_at < current_date - v_stale then 0.5 else 1 end as w
    from public.logs l
    join public.profiles p on p.id = l.user_id
    where l.shop_id = p_shop_id and p.created_at <= now() - v_new_account
    order by l.user_id, l.visited_at desc, l.created_at desc
  ) latest;

  v_adjusted := round((v_prior * v_mean + v_sum) / (v_prior + v_weight), 2);

  insert into public.shop_clout (shop_id, loggers, adjusted, first_log_at, last_log_at, updated_at)
  values (p_shop_id, v_loggers, v_adjusted, v_first, v_last, now())
  on conflict (shop_id) do update set
    loggers = excluded.loggers,
    adjusted = excluded.adjusted,
    first_log_at = excluded.first_log_at,
    last_log_at = excluded.last_log_at,
    updated_at = now();

  if v_loggers >= v_min_loggers and v_adjusted >= v_min_adjusted then
    update public.shops
    set promotion_status = 'flagged'
    where id = p_shop_id
      and promotion_status = 'none'
      and not exists (select 1 from public.shop_curations where shop_id = p_shop_id);
  end if;
end;
$$;

create or replace function public.on_log_change_clout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recompute_shop_clout(new.shop_id);
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.shop_id <> new.shop_id) then
    perform public.recompute_shop_clout(old.shop_id);
  end if;
  return null;
end;
$$;

drop trigger if exists on_log_insert_check_promotion on public.logs;
drop function if exists public.check_shop_promotion();

create trigger on_log_change_clout
  after insert or update or delete on public.logs
  for each row execute function public.on_log_change_clout();

revoke all on function public.recompute_shop_clout(uuid) from public, anon, authenticated;
revoke all on function public.on_log_change_clout() from public, anon, authenticated;

-- Backfill every shop that has logs.
select public.recompute_shop_clout(id) from public.shops s where exists (select 1 from public.logs l where l.shop_id = s.id);
