-- Database audit, 2026-09-27.

-- 1. Admins could never write shop_curations: 0008 gave it a read policy
--    only, so Approve (upsertShopCuration) was refused by RLS.
create policy "admins insert shop_curations" on public.shop_curations for insert with check (public.is_admin());
create policy "admins update shop_curations" on public.shop_curations for update using (public.is_admin()) with check (public.is_admin());
create policy "admins delete shop_curations" on public.shop_curations for delete using (public.is_admin());

-- 2. Deleting a city deleted every shop in it, and with them everyone's
--    logs. Shops outlive cities; they just lose the link.
alter table public.shops drop constraint shops_city_id_fkey;
alter table public.shops add constraint shops_city_id_fkey
  foreign key (city_id) references public.cities (id) on delete set null;

-- 3. The new row of an own-profile update is checked too, not just the old one.
alter policy "users update their own profile" on public.profiles
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- 4. Foreign keys without an index (advisor 0001): each one is a lookup the
--    app makes (collections by owner, followers, saves of a shop) or a
--    cascade that would scan the table.
create index if not exists lists_curator_id_idx on public.lists (curator_id);
create index if not exists lists_city_id_idx on public.lists (city_id);
create index if not exists list_items_shop_id_idx on public.list_items (shop_id);
create index if not exists list_saves_list_id_idx on public.list_saves (list_id);
create index if not exists shop_saves_shop_id_idx on public.shop_saves (shop_id);
create index if not exists follows_followee_id_idx on public.follows (followee_id);
create index if not exists comments_user_id_idx on public.comments (user_id);
create index if not exists comment_likes_user_id_idx on public.comment_likes (user_id);
create index if not exists log_likes_user_id_idx on public.log_likes (user_id);
create index if not exists shops_city_id_idx on public.shops (city_id);
create index if not exists admin_actions_actor_id_idx on public.admin_actions (actor_id);
create index if not exists admin_actions_target_user_id_idx on public.admin_actions (target_user_id);
