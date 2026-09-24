-- Map Phase 3: shops know their city, so city pages can list every rated shop.

alter table public.shops
  add column locality text,
  add column region text,
  add column country_code text,
  -- Same rule as cityKey() in packages/supabase/src/city.ts — keep in step.
  add column city_key text generated always as (
    case when locality is null then null
    else btrim(lower(regexp_replace(locality || '-' || coalesce(region, '') || '-' || coalesce(country_code, ''), '[^A-Za-z0-9]+', '-', 'g')), '-')
    end
  ) stored;

create index shops_city_key_idx on public.shops (city_key);

-- log_shop_visit gains the shop's city (from the app's /api/locate lookup).
-- Signature changes, so drop + recreate and restore the grants (0015 pattern).
drop function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date, text, text, text, text, text);

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
  p_hours text default null,
  p_locality text default null,
  p_region text default null,
  p_country_code text default null
)
returns table(shop_id uuid, log_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  if public.is_chain_name(p_name) then
    raise exception 'chain shops can''t be logged';
  end if;

  if v_website is not null and v_website !~* '^https?://' then
    v_website := null;
  end if;

  insert into public.shops (external_id, name, lat, lng, address, website, phone, hours, locality, region, country_code)
  values (
    p_external_id,
    p_name,
    p_lat,
    p_lng,
    left(nullif(btrim(p_address), ''), 300),
    left(v_website, 500),
    left(nullif(btrim(p_phone), ''), 50),
    left(nullif(btrim(p_hours), ''), 500),
    left(nullif(btrim(p_locality), ''), 100),
    left(nullif(btrim(p_region), ''), 100),
    upper(left(nullif(btrim(p_country_code), ''), 2))
  )
  on conflict (external_id) where external_id is not null do update set
    address      = coalesce(shops.address,      excluded.address),
    website      = coalesce(shops.website,      excluded.website),
    phone        = coalesce(shops.phone,        excluded.phone),
    hours        = coalesce(shops.hours,        excluded.hours),
    locality     = coalesce(shops.locality,     excluded.locality),
    region       = coalesce(shops.region,       excluded.region),
    country_code = coalesce(shops.country_code, excluded.country_code)
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
$function$;

revoke all on function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date, text, text, text, text, text, text, text, text) from public;
revoke all on function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date, text, text, text, text, text, text, text, text) from anon, authenticated;
grant execute on function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date, text, text, text, text, text, text, text, text) to authenticated;

-- shop_ratings exposes the city (appended; body otherwise as 0025).
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
  where not public.is_chain_name(s.name)
  group by s.id, sc.shop_id, sc.tag, sc.price_tier, sc.editorial_rating
  having sc.shop_id is not null or count(l.id) > 0;

-- Backfill the shops logged before this (Photon reverse lookup, 2026-09-24).
update public.shops s set locality = v.locality, region = v.region, country_code = v.cc
from (values
  ('way/271015925', 'Atlanta',  'Georgia', 'US'),
  ('way/992871109', 'Kennesaw', 'Georgia', 'US'),
  ('way/365590030', 'Roswell',  'Georgia', 'US'),
  ('way/298170920', 'Cobb',     'Georgia', 'US')
) as v(external_id, locality, region, cc)
where s.external_id = v.external_id;
