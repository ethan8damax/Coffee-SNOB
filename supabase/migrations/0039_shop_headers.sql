-- Photos Phase 2 (docs/superpowers/specs/2026-09-30-photos-phase-2-surfaces-design.md):
-- which photo heads each shop today. Computed, never stored (except the pin).
--
--   1. shops.header_photo_id, if that photo is still live.
--   2. Otherwise today's rotation: live photos with a short edge of 600 px or more;
--      landscape ones if the shop has any, else all of them; sorted by id, the
--      pick is hash(shop, day) mod count, so everyone sees the same photo all day.
--   3. Otherwise no row: each surface shows its own fallback.
--
-- Security invoker, so RLS applies (anyone reads live photos and profiles).
-- p_day only exists so tests can move the date.
--
-- Rollback: drop function public.shop_headers(uuid[], date);

create or replace function public.shop_headers(p_shop_ids uuid[], p_day date default (now() at time zone 'utc')::date)
returns table (
  shop_id uuid, photo_id uuid, path text, thumb_path text, width smallint, height smallint, username text, pinned boolean
)
language sql
stable
set search_path = public
as $$
  with pins as (
    select s.id as shop_id, p.id, p.path, p.thumb_path, p.width, p.height, p.user_id
    from public.shops s
    join public.log_photos p on p.id = s.header_photo_id and p.status = 'live'
    where s.id = any(p_shop_ids)
  ),
  eligible as (
    select p.shop_id, p.id, p.path, p.thumb_path, p.width, p.height, p.user_id,
           p.width > p.height as landscape,
           bool_or(p.width > p.height) over (partition by p.shop_id) as any_landscape
    from public.log_photos p
    where p.shop_id = any(p_shop_ids)
      and p.status = 'live'
      and least(p.width, p.height) >= 600
      and not exists (select 1 from pins where pins.shop_id = p.shop_id)
  ),
  ranked as (
    select e.*,
           row_number() over (partition by e.shop_id order by e.id) - 1 as idx,
           count(*) over (partition by e.shop_id) as n
    from eligible e
    where e.landscape or not e.any_landscape
  ),
  chosen as (
    select shop_id, id, path, thumb_path, width, height, user_id, true as pinned from pins
    union all
    select shop_id, id, path, thumb_path, width, height, user_id, false from ranked
    where idx = mod(abs(hashtext(shop_id::text || p_day::text)::bigint), n)
  )
  select c.shop_id, c.id, c.path, c.thumb_path, c.width, c.height, pr.username, c.pinned
  from chosen c
  left join public.profiles pr on pr.id = c.user_id;
$$;

revoke all on function public.shop_headers(uuid[], date) from public;
grant execute on function public.shop_headers(uuid[], date) to anon, authenticated;
