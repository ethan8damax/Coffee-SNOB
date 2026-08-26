-- Real launch markets (see apps/web/PRODUCT.md "Launch markets"). No shops
-- yet — nothing has cleared the two-visit curation bar in
-- apps/web/CURATION-STANDARDS.md, so these stay honestly empty.
insert into public.cities (slug, name, country, region, status) values
  -- Priority group
  ('new-york', 'New York', 'United States', 'North America', 'coming_soon'),
  ('atlanta', 'Atlanta', 'United States', 'North America', 'coming_soon'),
  ('nashville', 'Nashville', 'United States', 'North America', 'coming_soon'),
  ('london', 'London', 'United Kingdom', 'Europe', 'coming_soon'),
  ('tampa', 'Tampa', 'United States', 'North America', 'coming_soon'),
  -- Also mapped, lower priority
  ('portland', 'Portland', 'United States', 'North America', 'coming_soon'),
  ('seattle', 'Seattle', 'United States', 'North America', 'coming_soon'),
  ('san-francisco', 'San Francisco', 'United States', 'North America', 'coming_soon'),
  ('austin', 'Austin', 'United States', 'North America', 'coming_soon');
