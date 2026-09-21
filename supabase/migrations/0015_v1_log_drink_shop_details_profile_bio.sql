-- v1 data layer (docs/superpowers/specs/2026-09-21-v1-map-and-profile-phases-design.md):
--   * logs.drink            -- what the visitor ordered (log fields = verdict + drink + note)
--   * shops detail columns  -- address/website/phone/hours, filled from OSM when a shop is first logged
--   * profiles.bio          -- short public bio
--   * log_shop_visit        -- accepts the new fields and returns (shop_id, log_id)
--
-- shop_ratings (0010) is intentionally NOT touched: its HAVING clause is already
-- `sc.shop_id is not null or count(l.id) > 0`, i.e. a rated pin appears from the very
-- first log (decision D1), and is_snob_approved / the selected columns are unchanged.
-- Adding columns to shops does not affect the view (it lists its columns explicitly).
--
-- RLS was verified against production and needs no change: profiles/logs/follows are
-- publicly readable; "users manage their own logs" and "users manage their own follows"
-- are FOR ALL with auth.uid() = user_id / follower_id (using + with check), so a user can
-- only insert/delete their own rows; "users update their own profile" covers profiles.bio.
-- New columns inherit the table-level policies.

alter table public.logs
  add column drink text,
  add constraint logs_drink_length check (char_length(drink) <= 40);

alter table public.profiles
  add column bio text,
  add constraint profiles_bio_length check (char_length(bio) <= 280);

-- Detail columns are written by the log_shop_visit RPC from client-supplied OSM tags, and
-- rendered publicly (website becomes a link), so bound them at the table: length caps and
-- an http(s)-only website (blocks javascript:/data: URLs).
alter table public.shops
  add column address text,
  add column website text,
  add column phone text,
  add column hours text,  -- raw OSM opening_hours string, parsed client-side
  add constraint shops_address_length check (char_length(address) <= 300),
  add constraint shops_website_format check (website is null or (char_length(website) <= 500 and website ~* '^https?://')),
  add constraint shops_phone_length check (char_length(phone) <= 50),
  add constraint shops_hours_length check (char_length(hours) <= 500);

-- The return type changes (logs -> table(shop_id, log_id)), which `create or replace`
-- cannot do, and the parameter list grows, which would otherwise leave the old 7-arg
-- overload live next to the new one (ambiguous for PostgREST). Drop the old signature.
-- Its grants go with it; the new function's are re-asserted below exactly as in 0013
-- (execute for authenticated only; nothing for public/anon).
drop function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date);

create function public.log_shop_visit(
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
  on conflict (external_id) where external_id is not null do update set
    name    = excluded.name,
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
    p_note,
    left(nullif(btrim(p_drink), ''), 40),
    coalesce(p_visited_at, current_date)
  )
  returning id into v_log_id;

  return query select v_shop_id, v_log_id;
end;
$$;

revoke all on function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date, text, text, text, text, text) from public;
revoke all on function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date, text, text, text, text, text) from anon, authenticated;
grant execute on function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date, text, text, text, text, text) to authenticated;
