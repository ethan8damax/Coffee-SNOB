-- A shop earns a "rated" pin on the map once it's either Snob-Approved or
-- has at least one of our own users' logs — using the curated rating when
-- one exists, otherwise the rounded average of its logs (see
-- docs/superpowers/specs/2026-09-03-map-community-shops-design.md,
-- "Map rendering / integration"). security_invoker means this view runs
-- with the querying role's own privileges, so it's governed by the
-- existing public-read RLS policies on shops/shop_curations/logs — no
-- separate grant needed, same as every other table in this schema.
create view public.shop_ratings
with (security_invoker = true)
as
select
  s.id,
  s.name,
  s.lat,
  s.lng,
  s.city_id,
  s.neighborhood,
  (sc.shop_id is not null) as is_snob_approved,
  sc.tag,
  sc.price_tier,
  coalesce(sc.editorial_rating, round(avg(l.rating))::smallint) as rating,
  count(l.id) as log_count
from public.shops s
left join public.shop_curations sc on sc.shop_id = s.id
left join public.logs l on l.shop_id = s.id
group by s.id, sc.shop_id, sc.tag, sc.price_tier, sc.editorial_rating
having sc.shop_id is not null or count(l.id) > 0;
