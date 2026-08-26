-- Dev-only fixture. NOT run against production. Lisbon is not a real
-- launch market — this gives local development real-shaped data to render
-- (a full city guide, 7 shops) without it ever being live. Load manually
-- against a local/dev Supabase instance if you need it:
--   psql "$DEV_DATABASE_URL" -f supabase/seed.dev.sql

insert into public.cities (slug, name, country, region, status) values
  ('lisbon', 'Lisbon', 'Portugal', 'Europe', 'demo');

with lisbon as (select id from public.cities where slug = 'lisbon')
insert into public.shops (city_id, name, neighborhood, price_tier, tag, writeup, order_note, editorial_rating)
select lisbon.id, s.name, s.neighborhood, s.price_tier, s.tag, s.writeup, s.order_note, s.editorial_rating
from lisbon, (values
  ('Noi Coffee', 'Príncipe Real', '€€', 'Espresso bar',
   'The best-run bar in the country. Two grinders, one Ethiopian on filter, and a barista who will ask what you drank yesterday. Order at the counter and stay standing.',
   'Filter — whatever is newest', 5::smallint),
  ('Fábrica Coffee Roasters', 'Baixa', '€€', 'Roaster',
   'Roasts in the back, sells across the counter, and does not pretend the room is anything other than a workshop. The cortado is the control sample.',
   'Cortado, plus a bag of the Colombian', 4::smallint),
  ('Copenhagen Coffee Lab', 'Príncipe Real', '€€', 'Filter focus',
   'Nordic import that made light roast normal here. Bright, consistent, occasionally too full to sit. The pastry is better than it needs to be.',
   'V60, single origin', 4::smallint),
  ('Olisipo Roastery', 'Alcântara', '€€€', 'Roaster',
   'A working roastery with a cupping table open to the public on Fridays. Ask about the Brazilian naturals if the door is open.',
   'Whatever is on the cupping table', 4::smallint),
  ('Café Graça', 'Graça', '€', 'Neighbourhood',
   'Not a specialty room and not trying to be. Good beans, old tiles, three tables outside facing the wrong way for the view — which is the point.',
   'Espresso, one sugar, standing', 3::smallint),
  ('Tartine Baixa', 'Baixa', '€€', 'Bakery bar',
   'Coffee is a strong second act to the bread. Reroute if you are already walking past; do not plan a morning around it.',
   'Flat white and the sourdough', 3::smallint),
  ('Comoba', 'Cais do Sodré', '€€', 'All-day',
   'Pleasant, busy, and fine. The kitchen is the reason to come; the coffee follows the room rather than leading it.',
   'Breakfast, coffee incidental', 2::smallint)
) as s(name, neighborhood, price_tier, tag, writeup, order_note, editorial_rating);

with lisbon as (select id from public.cities where slug = 'lisbon')
insert into public.lists (type, slug, title, description, body, city_id, save_count)
select
  'city_guide',
  'lisbon',
  'Lisbon',
  'Eleven years of tiled cafés and a new generation that learned to roast light.',
  'Lisbon drinks more coffee per head than almost anywhere in Europe and, until recently, drank it badly on purpose — dark, cheap, and standing up. The habit survived; the beans changed. A handful of rooms opened in the last decade that roast light, weigh doses, and still sell an espresso for a euro twenty at the counter.

This guide covers seven shops we drank at more than once, across four neighbourhoods. The verdicts are ours, nobody paid to be here, and the ones we left out were left out on purpose.',
  lisbon.id,
  0
from lisbon;

with l as (select id from public.lists where slug = 'lisbon'),
     ordered as (
       select s.id, s.name,
         row_number() over (
           order by array_position(
             array['Noi Coffee','Fábrica Coffee Roasters','Copenhagen Coffee Lab','Olisipo Roastery','Café Graça','Tartine Baixa','Comoba'],
             s.name
           )
         ) as pos
       from public.shops s
       join public.cities c on c.id = s.city_id
       where c.slug = 'lisbon'
     )
insert into public.list_items (list_id, shop_id, position)
select l.id, ordered.id, ordered.pos from l, ordered;
