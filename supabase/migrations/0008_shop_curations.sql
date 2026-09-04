-- Split shop curation content into its own table, layered on top of a
-- shop's base identity (see docs/superpowers/specs/2026-09-03-map-
-- community-shops-design.md). A shop_curations row existing IS what
-- "Snob-Approved" means — no boolean/enum needed. shops gains what a
-- shop needs when it only exists because someone logged a visit to a
-- live OpenStreetMap result: external_id for dedup, and city_id/
-- neighborhood become optional since such a shop may be outside every
-- city we've launched.

alter table public.shops
  add column external_id text,
  add column promotion_status text not null default 'none'
    check (promotion_status in ('none', 'flagged', 'rejected')),
  alter column city_id drop not null,
  alter column neighborhood drop not null;

create unique index shops_external_id_key on public.shops (external_id)
  where external_id is not null;

create table public.shop_curations (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  writeup text,
  order_note text,
  editorial_rating smallint check (editorial_rating between 1 and 5),
  tag text,
  price_tier text not null default '€€' check (price_tier in ('€', '€€', '€€€')),
  created_at timestamptz not null default now()
);

alter table public.shop_curations enable row level security;
create policy "shop curations are publicly readable" on public.shop_curations for select using (true);

-- Every existing shops row today is a curated one (nothing else was
-- possible before this migration) — move that content onto the new layer.
insert into public.shop_curations (shop_id, writeup, order_note, editorial_rating, tag, price_tier)
select id, writeup, order_note, editorial_rating, tag, price_tier from public.shops;

alter table public.shops
  drop column writeup,
  drop column order_note,
  drop column editorial_rating,
  drop column tag,
  drop column price_tier;
