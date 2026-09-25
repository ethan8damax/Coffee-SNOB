-- Covering index for the FK (Supabase performance advisor).
create index place_overrides_created_by_idx on public.place_overrides (created_by);
