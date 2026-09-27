-- Joins a searched place (Photon) to its editorial city row, so search can
-- offer a "Guide" link only when a curated guide exists. Same rule as
-- cityKey() in packages/supabase/src/city.ts and shops.city_key (0026).
alter table public.cities add column city_key text unique;

update public.cities c set city_key = v.key
from (values
  ('tampa', 'tampa-florida-us'),
  ('atlanta', 'atlanta-georgia-us'),
  ('austin', 'austin-texas-us'),
  ('nashville', 'nashville-tennessee-us'),
  ('new-york', 'new-york-new-york-us'),
  ('portland', 'portland-oregon-us'),
  ('san-francisco', 'san-francisco-california-us'),
  ('seattle', 'seattle-washington-us'),
  ('london', 'london-england-gb')
) as v(slug, key)
where c.slug = v.slug;
