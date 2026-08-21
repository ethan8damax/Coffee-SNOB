create table public.lists (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('city_guide', 'collection')),
  slug text unique not null,
  title text not null,
  description text,
  body text,
  city_id uuid references public.cities(id) on delete cascade,
  curator_id uuid references auth.users(id) on delete set null,
  cover_photo_alt text,
  save_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint city_guide_has_city check (type <> 'city_guide' or city_id is not null)
);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  position integer not null,
  note text,
  unique (list_id, shop_id)
);

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

create policy "lists are publicly readable" on public.lists for select using (true);
create policy "list_items are publicly readable" on public.list_items for select using (true);
