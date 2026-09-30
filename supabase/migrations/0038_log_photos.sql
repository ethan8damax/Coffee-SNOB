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
