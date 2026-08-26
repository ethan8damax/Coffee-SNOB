-- Priority launch cities decided 2026-08-26 (see PRODUCT.md "Launch
-- markets"): NYC and Tampa were already seeded; this adds the other three
-- priority-group cities. Portland/Seattle/SF/Austin stay mapped as
-- lower-priority coming_soon (already seeded, unchanged).
insert into public.cities (slug, name, country, region, status) values
  ('atlanta', 'Atlanta', 'United States', 'North America', 'coming_soon'),
  ('nashville', 'Nashville', 'United States', 'North America', 'coming_soon'),
  ('london', 'London', 'United Kingdom', 'Europe', 'coming_soon');
