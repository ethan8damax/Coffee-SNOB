-- Curation Phase 5: roasters and their stockist lists
-- (docs/superpowers/specs/2026-09-27-curation-phase-5-roasters-design.md).
-- The monthly build matches each stockist line to a coffee index place;
-- those matches live in the build report. matched_id is only the admin's
-- hand fix, so a wrong automatic match is never baked in.

create table public.roasters (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  website text check (char_length(website) <= 500),
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);

create table public.roaster_stockists (
  id uuid primary key default gen_random_uuid(),
  roaster_id uuid not null references public.roasters (id) on delete cascade,
  raw_name text not null check (char_length(raw_name) between 1 and 200),
  raw_address text not null default '' check (char_length(raw_address) <= 500),
  matched_id text check (matched_id ~ '^cs_[0-9a-f]{12}$'),
  added_at timestamptz not null default now(),
  -- Pasting the same list twice adds nothing.
  unique (roaster_id, raw_name, raw_address)
);

-- Public read: the build reads with the anon key, and stockist lists are
-- already public on roasters' own sites.
alter table public.roasters enable row level security;
create policy "roasters are publicly readable" on public.roasters for select using (true);
create policy "admins insert roasters" on public.roasters for insert with check (public.is_admin());
create policy "admins update roasters" on public.roasters for update using (public.is_admin()) with check (public.is_admin());
create policy "admins delete roasters" on public.roasters for delete using (public.is_admin());

alter table public.roaster_stockists enable row level security;
create policy "roaster stockists are publicly readable" on public.roaster_stockists for select using (true);
create policy "admins insert roaster_stockists" on public.roaster_stockists for insert with check (public.is_admin());
create policy "admins update roaster_stockists" on public.roaster_stockists for update using (public.is_admin()) with check (public.is_admin());
create policy "admins delete roaster_stockists" on public.roaster_stockists for delete using (public.is_admin());
