-- Match chains by their OSM brand:wikidata ID, not just their name. The ID is
-- the same in every country and language (Starbucks is Q37158 whether the
-- café is tagged "Starbucks" or "スターバックス"), which the name match can't do.
-- IDs come from OSM's Name Suggestion Index (the admin lookup on /admin/shops
-- fills this in). Name matching stays as the fallback for untagged cafés.
alter table public.chain_blocklist
  add column wikidata text unique check (wikidata ~ '^Q[0-9]+$');

-- Re-adding a chain from the admin lookup attaches its ID to the existing row.
create policy "admins update chain_blocklist" on public.chain_blocklist for update using (public.is_admin()) with check (public.is_admin());

update public.chain_blocklist c set wikidata = v.id from (values
  ('starbucks', 'Q37158'), ('dunkin', 'Q847743'), ('caribou coffee', 'Q5039494'),
  ('peets coffee', 'Q1094101'), ('tim hortons', 'Q175106'), ('dutch bros', 'Q5317253'),
  ('scooters coffee', 'Q117280308'), ('biggby coffee', 'Q4906876'), ('tullys coffee', 'Q3541983'),
  ('the coffee bean tea leaf', 'Q1141384'), ('costa coffee', 'Q608845'), ('caffe nero', 'Q675808'),
  ('pret a manger', 'Q2109109'), ('mccafe', 'Q3114287'), ('krispy kreme', 'Q1192805'),
  ('7 brew', 'Q131838275'), ('second cup', 'Q862180'), ('einstein bros bagels', 'Q5349788')
) as v(name, id) where c.name = v.name;

-- Mass-market chains in other markets (Japan, Korea, China, SE Asia, LatAm,
-- Europe, Australia), found on live OSM data or in the Name Suggestion Index.
insert into public.chain_blocklist (name, wikidata) values
  ('starbucks reserve', 'Q71150001'), ('doutor', 'Q11322732'), ('excelsior caffe', 'Q11289828'),
  ('caffe veloce', 'Q11294597'), ('st marc cafe', 'Q11305988'), ('pronto', 'Q11336224'),
  ('renoir', 'Q11649991'), ('komedas coffee', 'Q11302679'), ('hoshino coffee', 'Q88396880'),
  ('ueshima coffee house', 'Q96152143'), ('kohikan', 'Q11573290'), ('cafe de crie', 'Q131692144'),
  ('luckin coffee', 'Q56811344'), ('cotti coffee', 'Q123370986'), ('cafe amazon', 'Q43247503'),
  ('cafe coffee day', 'Q5017235'), ('juan valdez cafe', 'Q6301102'), ('tom n toms', 'Q18142418'),
  ('ediya coffee', 'Q12611298'), ('mega coffee', 'Q120998343'), ('compose coffee', 'Q120997937'),
  ('paiks coffee', 'Q55730575'), ('angel in us coffee', 'Q12606781'), ('coffee island', 'Q60867333'),
  ('the coffee club', 'Q7726599'), ('muffin break', 'Q16964876'), ('espresso house', 'Q10489162'),
  ('coffee fellows', 'Q23461429')
on conflict (name) do nothing;
