create table public.cities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  country text not null,
  region text not null,
  status text not null default 'coming_soon' check (status in ('live', 'coming_soon', 'demo')),
  created_at timestamptz not null default now()
);

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  name text not null,
  neighborhood text not null,
  lat double precision,
  lng double precision,
  price_tier text not null default '€€' check (price_tier in ('€', '€€', '€€€')),
  tag text,
  writeup text,
  order_note text,
  editorial_rating smallint check (editorial_rating between 1 and 5),
  created_at timestamptz not null default now()
);

alter table public.cities enable row level security;
alter table public.shops enable row level security;

-- Published content is public read-only. Writes go through the service-role
-- key (seed scripts, future editorial tooling) — there is no end-user write
-- path onto cities/shops, so no insert/update/delete policy is defined.
create policy "cities are publicly readable" on public.cities for select using (true);
create policy "shops are publicly readable" on public.shops for select using (true);
