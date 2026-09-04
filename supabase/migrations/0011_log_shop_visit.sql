-- Atomically upserts a shop by its OpenStreetMap id (a shops row for a
-- live OSM result is only created the first time someone logs a visit to
-- it — see docs/superpowers/specs/2026-09-03-map-community-shops-
-- design.md) and inserts the log, in one round trip. security definer
-- because creating the shops row needs an insert that authenticated users
-- have no direct policy for (curated shops still only come from the
-- admin dashboard) — auth.uid() is checked explicitly inside rather than
-- trusted from the caller, since a definer function runs with elevated
-- privilege regardless of who calls it.
create or replace function public.log_shop_visit(
  p_external_id text,
  p_name text,
  p_lat double precision,
  p_lng double precision,
  p_rating smallint,
  p_note text default null,
  p_visited_at date default current_date
)
returns public.logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
  v_log public.logs;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated to log a visit';
  end if;

  -- external_id's unique index (0008_shop_curations.sql) is partial
  -- (where external_id is not null), so the arbiter predicate must be
  -- repeated here or Postgres can't infer it as the conflict target.
  insert into public.shops (external_id, name, lat, lng)
  values (p_external_id, p_name, p_lat, p_lng)
  on conflict (external_id) where external_id is not null do update set name = excluded.name
  returning id into v_shop_id;

  insert into public.logs (user_id, shop_id, rating, note, visited_at)
  values (auth.uid(), v_shop_id, p_rating, p_note, coalesce(p_visited_at, current_date))
  returning * into v_log;

  return v_log;
end;
$$;

revoke all on function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date) from public;
grant execute on function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date) to authenticated;
