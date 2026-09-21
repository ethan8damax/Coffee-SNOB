-- Sign-up failed with "Database error saving new user" whenever the email's local part
-- ("ethan2damax" in ethan2damax@example.com) was already someone's username: the trigger inserted
-- it as-is into the unique profiles.username. Now: keep only [a-z0-9_], cap at 20 chars, and
-- append a random 4-digit suffix until it's free. Onboarding still lets people pick their own.
-- create or replace keeps the grants 0012/0013 locked down (trigger-only, no direct execute).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text := left(lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g')), 20);
  candidate text;
begin
  if base = '' then base := 'snob'; end if;
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    candidate := base || (floor(random() * 9000) + 1000)::int;
  end loop;
  insert into public.profiles (id, username) values (new.id, candidate);
  return new;
end;
$$;
