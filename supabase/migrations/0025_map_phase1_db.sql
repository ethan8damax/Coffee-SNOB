-- Map Phase 1 (docs/superpowers/specs/2026-09-23-map-browse-and-search-design.md).

-- 1. Expose external_id so the app can drop the OSM dot that duplicates a
--    rated pin. Appended last: create or replace view may only add columns
--    at the end. Body otherwise identical to 0022.
create or replace view public.shop_ratings with (security_invoker = true) as
  select s.id,
    s.name,
    s.lat,
    s.lng,
    s.city_id,
    s.neighborhood,
    sc.shop_id is not null as is_snob_approved,
    sc.tag,
    sc.price_tier,
    coalesce(sc.editorial_rating, round(avg(l.rating))::smallint) as rating,
    count(l.id) as log_count,
    s.external_id
  from shops s
    left join shop_curations sc on sc.shop_id = s.id
    left join logs l on l.shop_id = s.id
  where not public.is_chain_name(s.name)
  group by s.id, sc.shop_id, sc.tag, sc.price_tier, sc.editorial_rating
  having sc.shop_id is not null or count(l.id) > 0;

-- 2. Profiles and the feed look logs up by user.
create index if not exists logs_user_id_idx on public.logs (user_id);

-- 3. Same rules, but auth.uid() evaluated once per query instead of per row
--    (Supabase advisor auth_rls_initplan). alter policy keeps names/roles/cmds.
alter policy "admins insert admin_actions" on public.admin_actions
  with check (public.is_admin() and actor_id = (select auth.uid()));
alter policy "users manage their own comment likes" on public.comment_likes
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "users manage their own comments" on public.comments
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "users manage their own follows" on public.follows
  using ((select auth.uid()) = follower_id) with check ((select auth.uid()) = follower_id);
alter policy "users manage their own saves" on public.list_saves
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "users manage their own log likes" on public.log_likes
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "users manage their own logs" on public.logs
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "users insert their own profile" on public.profiles
  with check ((select auth.uid()) = id);
alter policy "users update their own profile" on public.profiles
  using ((select auth.uid()) = id);
alter policy "users manage their own shop saves" on public.shop_saves
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
