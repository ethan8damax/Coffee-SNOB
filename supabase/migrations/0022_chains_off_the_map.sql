-- Keep chain_blocklist (0021) chains off the map entirely, not just out of the
-- OSM layer: they can't be logged, and any already in shops drop out of
-- shop_ratings (rated pins + rated-shop search). Their logs stay on profiles.

-- SQL twin of normalizeChainName/isChain in apps/web/lib/nearby-shops.ts:
-- lowercase, drop apostrophes, other non-alphanumerics to spaces, then match a
-- blocklist entry exactly or as leading whole words. Keep the two in step.
-- ponytail: no unaccent extension here, so accents are folded with translate()
-- for the common Latin set only; add characters if a chain name needs them.
-- Not security definer: chain_blocklist is public-read, same posture as is_admin().
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
      '[^a-z0-9]+', ' ', 'g')) as v
  )
  select exists (
    select 1 from public.chain_blocklist b, n
    where n.v = b.name or n.v like b.name || ' %'
  );
$$;

-- Same body as 0015/0020's latest version plus the chain check.
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
$function$;

-- Same view as 0010, minus chains. security_invoker restated so the replace keeps it.
-- ponytail: is_chain_name runs per shop against a ~20-row list; fine at this
-- scale, move to a stored shops.is_chain flag if shop_ratings gets slow.
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
    count(l.id) as log_count
  from shops s
    left join shop_curations sc on sc.shop_id = s.id
    left join logs l on l.shop_id = s.id
  where not public.is_chain_name(s.name)
  group by s.id, sc.shop_id, sc.tag, sc.price_tier, sc.editorial_rating
  having sc.shop_id is not null or count(l.id) > 0;
