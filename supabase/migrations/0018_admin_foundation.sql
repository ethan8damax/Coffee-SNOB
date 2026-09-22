-- Admin foundation (see docs/superpowers/specs/2026-08-26-map-and-admin-dashboard-design.md
-- and docs/superpowers/plans/2026-09-22-admin-dashboard-foundation.md). Adds the is_admin
-- flag the August spec designed, an is_admin() helper for use inside RLS policies, and the
-- admin write policies on cities/shops/lists/list_items that spec scoped but never applied
-- (today only service_role can write to these tables — no policy exists for anyone else).

alter table public.profiles add column is_admin boolean not null default false;

-- Not security definer: it only reads profiles, which already has a public-read policy
-- ("profiles are publicly readable"), so this needs no elevated privilege — same posture
-- as the non-security-definer helper style used elsewhere in this schema.
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create policy "admins insert cities" on public.cities for insert with check (public.is_admin());
create policy "admins update cities" on public.cities for update using (public.is_admin()) with check (public.is_admin());
create policy "admins delete cities" on public.cities for delete using (public.is_admin());

create policy "admins insert shops" on public.shops for insert with check (public.is_admin());
create policy "admins update shops" on public.shops for update using (public.is_admin()) with check (public.is_admin());
create policy "admins delete shops" on public.shops for delete using (public.is_admin());

create policy "admins insert lists" on public.lists for insert with check (public.is_admin());
create policy "admins update lists" on public.lists for update using (public.is_admin()) with check (public.is_admin());
create policy "admins delete lists" on public.lists for delete using (public.is_admin());

create policy "admins insert list_items" on public.list_items for insert with check (public.is_admin());
create policy "admins update list_items" on public.list_items for update using (public.is_admin()) with check (public.is_admin());
create policy "admins delete list_items" on public.list_items for delete using (public.is_admin());
