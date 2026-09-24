-- Chain coffee shops hidden from the map's OpenStreetMap layer (and shop search).
-- Names are stored normalized by the app (lowercase, apostrophes dropped, other
-- punctuation collapsed to spaces — see normalizeChainName in
-- apps/web/lib/nearby-shops.ts), so the primary key also stops duplicates.
-- Anyone can read (the public nearby-shops proxy uses the anon key); only admins
-- can change it, managed from /admin/shops.
create table public.chain_blocklist (
  name text primary key check (name <> '' and name = lower(name)),
  created_at timestamptz not null default now()
);

alter table public.chain_blocklist enable row level security;

-- Same policy shape as cities/shops (0018): public read, admin-only writes via
-- is_admin(). Not recorded in admin_actions, which only audits user-targeted actions.
create policy "chain blocklist is publicly readable" on public.chain_blocklist for select using (true);
create policy "admins insert chain_blocklist" on public.chain_blocklist for insert with check (public.is_admin());
create policy "admins delete chain_blocklist" on public.chain_blocklist for delete using (public.is_admin());

insert into public.chain_blocklist (name) values
  ('starbucks'), ('dunkin'), ('caribou coffee'), ('peets coffee'), ('tim hortons'),
  ('dutch bros'), ('scooters coffee'), ('biggby coffee'), ('tullys coffee'),
  ('the coffee bean tea leaf'), ('costa coffee'), ('caffe nero'), ('pret a manger'),
  ('mccafe'), ('krispy kreme'), ('7 brew'), ('black rock coffee bar'), ('ziggis coffee'),
  ('gloria jeans coffees'), ('second cup'), ('einstein bros bagels');
