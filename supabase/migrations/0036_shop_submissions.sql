-- Add a shop (spec 2026-09-29-add-a-shop-design.md): anyone signed in can send
-- a missing shop; an admin puts it on the map or passes. Admins' own adds go
-- live immediately.

-- ── submissions ──────────────────────────────────────────────────────────
create table public.shop_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  address text check (char_length(address) <= 300),
  hours text check (char_length(hours) <= 500),
  website text check (website is null or (char_length(website) <= 500 and website ~* '^https?://')),
  roaster text check (char_length(roaster) <= 120),
  note text check (char_length(note) <= 500),
  locality text check (char_length(locality) <= 100),
  region text check (char_length(region) <= 100),
  country_code text check (char_length(country_code) <= 2),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decline_reason text check (char_length(decline_reason) <= 300),
  shop_id uuid references public.shops (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index shop_submissions_user_idx on public.shop_submissions (user_id, created_at);
create index shop_submissions_pending_idx on public.shop_submissions (created_at) where status = 'pending';
create index shop_submissions_shop_idx on public.shop_submissions (shop_id);
create index shop_submissions_reviewed_by_idx on public.shop_submissions (reviewed_by);

alter table public.shop_submissions enable row level security;
create policy "senders and admins read submissions" on public.shop_submissions
  for select using (user_id = (select auth.uid()) or public.is_admin());
-- No insert/update/delete policies: writes go through the functions below.

-- ── a new hand-added shop needs an admin ─────────────────────────────────
-- Covers every path that inserts into shops (log_shop_visit, ensure_shop,
-- direct inserts): logging an approved user/ shop still works, creating one
-- doesn't. The service role (seed scripts, no auth.uid()) is let through.
create or replace function public.guard_user_shop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.external_id like 'user/%'
     and auth.uid() is not null
     and not public.is_admin()
     and not exists (select 1 from public.shops where external_id = new.external_id) then
    raise exception 'new shops need an admin''s approval';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_user_shop() from public, anon, authenticated;
create trigger shops_guard_user_shop before insert on public.shops
  for each row execute function public.guard_user_shop();

-- ── notifications learn two kinds ────────────────────────────────────────
alter table public.notifications
  alter column shop_id drop not null,
  add column submission_id uuid references public.shop_submissions (id) on delete cascade,
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check check (kind in ('snob_approved', 'shop_added', 'shop_declined')),
  add constraint notifications_target check (shop_id is not null or submission_id is not null);
create index notifications_submission_idx on public.notifications (submission_id);

-- ── shared: make the shop from a submission row ──────────────────────────
create or replace function public.shop_from_submission(s public.shop_submissions)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
begin
  insert into public.shops (external_id, name, lat, lng, address, website, hours, locality, region, country_code)
  values ('user/' || gen_random_uuid(), s.name, s.lat, s.lng, s.address, s.website, s.hours, s.locality, s.region, s.country_code)
  returning id into v_shop_id;
  return v_shop_id;
end;
$$;
revoke all on function public.shop_from_submission(public.shop_submissions) from public, anon, authenticated;

-- ── send one ─────────────────────────────────────────────────────────────
create or replace function public.submit_shop(
  p_name text,
  p_lat double precision,
  p_lng double precision,
  p_address text default null,
  p_hours text default null,
  p_website text default null,
  p_roaster text default null,
  p_note text default null,
  p_locality text default null,
  p_region text default null,
  p_country_code text default null
)
returns table(submission_id uuid, shop_id uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_row public.shop_submissions;
  v_website text := nullif(btrim(p_website), '');
  v_admin boolean := public.is_admin();
begin
  if auth.uid() is null then raise exception 'must be signed in'; end if;
  if not public.is_active() then raise exception 'account is suspended'; end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'a shop needs a name'; end if;
  if public.is_chain_name(btrim(p_name)) then raise exception 'chain shops can''t be added'; end if;
  if not v_admin and (select count(*) from public.shop_submissions
      where user_id = auth.uid() and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'that''s 10 shops today — send more tomorrow';
  end if;
  if v_website is not null and v_website !~* '^https?://' then v_website := null; end if;

  insert into public.shop_submissions (user_id, name, lat, lng, address, hours, website, roaster, note, locality, region, country_code)
  values (
    auth.uid(), left(btrim(p_name), 120), p_lat, p_lng,
    left(nullif(btrim(p_address), ''), 300), left(nullif(btrim(p_hours), ''), 500), left(v_website, 500),
    left(nullif(btrim(p_roaster), ''), 120), left(nullif(btrim(p_note), ''), 500),
    left(nullif(btrim(p_locality), ''), 100), left(nullif(btrim(p_region), ''), 100),
    upper(left(nullif(btrim(p_country_code), ''), 2))
  )
  returning * into v_row;

  if v_admin then
    update public.shop_submissions
      set status = 'approved', shop_id = public.shop_from_submission(v_row), reviewed_by = auth.uid(), reviewed_at = now()
      where id = v_row.id
      returning * into v_row;
  end if;
  return query select v_row.id, v_row.shop_id;
end;
$$;
revoke all on function public.submit_shop(text, double precision, double precision, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_shop(text, double precision, double precision, text, text, text, text, text, text, text, text) to authenticated;

-- ── admin: put it on the map (with any edits) ────────────────────────────
create or replace function public.approve_shop_submission(
  p_id uuid,
  p_name text,
  p_lat double precision,
  p_lng double precision,
  p_address text default null,
  p_hours text default null,
  p_website text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.shop_submissions;
  v_website text := nullif(btrim(p_website), '');
  v_shop_id uuid;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if v_website is not null and v_website !~* '^https?://' then v_website := null; end if;
  update public.shop_submissions set
    name = left(btrim(p_name), 120), lat = p_lat, lng = p_lng,
    address = left(nullif(btrim(p_address), ''), 300), hours = left(nullif(btrim(p_hours), ''), 500), website = left(v_website, 500)
    where id = p_id and status = 'pending'
    returning * into v_row;
  if v_row.id is null then raise exception 'submission not found or already decided'; end if;

  v_shop_id := public.shop_from_submission(v_row);
  update public.shop_submissions set status = 'approved', shop_id = v_shop_id, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_id;
  if v_row.user_id <> auth.uid() then
    insert into public.notifications (user_id, kind, shop_id, submission_id) values (v_row.user_id, 'shop_added', v_shop_id, p_id);
  end if;
  return v_shop_id;
end;
$$;
revoke all on function public.approve_shop_submission(uuid, text, double precision, double precision, text, text, text) from public, anon, authenticated;
grant execute on function public.approve_shop_submission(uuid, text, double precision, double precision, text, text, text) to authenticated;

-- ── admin: pass ──────────────────────────────────────────────────────────
create or replace function public.decline_shop_submission(p_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  update public.shop_submissions
    set status = 'declined', decline_reason = left(nullif(btrim(p_reason), ''), 300), reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_id and status = 'pending'
    returning user_id into v_user;
  if v_user is null then raise exception 'submission not found or already decided'; end if;
  if v_user <> auth.uid() then
    insert into public.notifications (user_id, kind, submission_id) values (v_user, 'shop_declined', p_id);
  end if;
end;
$$;
revoke all on function public.decline_shop_submission(uuid, text) from public, anon, authenticated;
grant execute on function public.decline_shop_submission(uuid, text) to authenticated;
