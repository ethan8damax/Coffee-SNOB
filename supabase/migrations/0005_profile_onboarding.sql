alter table public.profiles
  add column display_name text,
  add column onboarded_at timestamptz;
