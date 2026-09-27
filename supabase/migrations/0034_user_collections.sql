-- User collections, Faves and Top 4
-- (docs/superpowers/specs/2026-09-27-user-collections-design.md).

-- ── Collections: the existing lists table, owned and public or private ──
alter table public.lists add column is_public boolean not null default false;
update public.lists set is_public = true where type = 'city_guide' or curator_id is null;

drop policy "lists are publicly readable" on public.lists;
create policy "lists readable when public or yours" on public.lists for select
  using (type = 'city_guide' or is_public or curator_id = (select auth.uid()));
create policy "users create their own collections" on public.lists for insert
  with check (type = 'collection' and curator_id = (select auth.uid()));
create policy "users edit their own collections" on public.lists for update
  using (type = 'collection' and curator_id = (select auth.uid()))
  with check (type = 'collection' and curator_id = (select auth.uid()));
create policy "users delete their own collections" on public.lists for delete
  using (type = 'collection' and curator_id = (select auth.uid()));
create policy "must be active to insert" on public.lists as restrictive for insert with check (public.is_active());

-- Slugs are generated; users never see or set them. Owners can't touch the
-- save count, type, slug or owner. pg_trigger_depth() = 1 is a direct write;
-- the save-count trigger's own update runs deeper and passes through.
create or replace function public.guard_list_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.slug is null then
      new.slug := coalesce(nullif(trim(both '-' from regexp_replace(lower(new.title), '[^a-z0-9]+', '-', 'g')), ''), 'collection')
        || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
    end if;
    if not public.is_admin() then new.save_count := 0; end if;
  elsif pg_trigger_depth() = 1 and not public.is_admin() then
    new.save_count := old.save_count;
    new.type := old.type;
    new.slug := old.slug;
    new.curator_id := old.curator_id;
    new.city_id := old.city_id;
  end if;
  return new;
end;
$$;
-- NOT NULL is checked after BEFORE triggers, so the generated slug satisfies it.
create trigger guard_list_write before insert or update on public.lists
  for each row execute function public.guard_list_write();

-- Items follow their list: readable when the list is (the subquery runs
-- under the lists policy), written by the list's owner.
drop policy "list_items are publicly readable" on public.list_items;
create policy "list items readable with their list" on public.list_items for select
  using (exists (select 1 from public.lists l where l.id = list_id));
create policy "owners add to their collections" on public.list_items for insert
  with check (exists (select 1 from public.lists l where l.id = list_id and l.type = 'collection' and l.curator_id = (select auth.uid())));
create policy "owners edit their collections" on public.list_items for update
  using (exists (select 1 from public.lists l where l.id = list_id and l.type = 'collection' and l.curator_id = (select auth.uid())));
create policy "owners remove from their collections" on public.list_items for delete
  using (exists (select 1 from public.lists l where l.id = list_id and l.type = 'collection' and l.curator_id = (select auth.uid())));
create policy "must be active to insert" on public.list_items as restrictive for insert with check (public.is_active());

-- New items go to the end; a collection holds at most 200 cafés.
create or replace function public.place_list_item()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*), coalesce(max(position), 0) + 1 into v_count, new.position
  from public.list_items where list_id = new.list_id;
  if v_count >= 200 then
    raise exception 'a collection holds at most 200 cafés';
  end if;
  return new;
end;
$$;
create trigger place_list_item before insert on public.list_items
  for each row when (new.position is null) execute function public.place_list_item();
create or replace function public.cap_list_items()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.list_items where list_id = new.list_id) >= 200 then
    raise exception 'a collection holds at most 200 cafés';
  end if;
  return new;
end;
$$;
create trigger cap_list_items before insert on public.list_items
  for each row when (new.position is not null) execute function public.cap_list_items();

-- Save counts: the trigger now runs as its owner, so a saver (who can't
-- update someone else's list) still moves the count.
alter function public.handle_list_save_change() security definer;
revoke all on function public.handle_list_save_change() from public, anon, authenticated;

-- ── Faves: saved shops and collections, public if the owner says so ────
alter table public.profiles add column faves_public boolean not null default false;

create policy "saves readable when faves are public" on public.list_saves for select
  using (exists (select 1 from public.profiles p where p.id = user_id and p.faves_public));
-- You can only save what you can see.
create policy "only readable lists can be saved" on public.list_saves as restrictive for insert
  with check (exists (select 1 from public.lists l where l.id = list_id));
create policy "shop saves readable when faves are public" on public.shop_saves for select to anon, authenticated
  using (exists (select 1 from public.profiles p where p.id = user_id and p.faves_public));

-- ── Top 4 ──────────────────────────────────────────────────────────────
create table public.profile_top_shops (
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot smallint not null check (slot between 1 and 4),
  shop_id uuid not null references public.shops (id) on delete cascade,
  primary key (user_id, slot),
  unique (user_id, shop_id)
);
create index profile_top_shops_shop_idx on public.profile_top_shops (shop_id);
alter table public.profile_top_shops enable row level security;
create policy "top shops are publicly readable" on public.profile_top_shops for select using (true);
create policy "users pick their own top shops" on public.profile_top_shops for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── ensure_shop: the shop half of log_shop_visit, with no log ──────────
create or replace function public.ensure_shop(
  p_external_id text,
  p_name text,
  p_lat double precision,
  p_lng double precision,
  p_address text default null,
  p_website text default null,
  p_phone text default null,
  p_hours text default null,
  p_locality text default null,
  p_region text default null,
  p_country_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
  v_website text := nullif(btrim(p_website), '');
begin
  if auth.uid() is null then raise exception 'must be signed in'; end if;
  if not public.is_active() then raise exception 'account is suspended'; end if;
  if public.is_chain_name(p_name) then raise exception 'chain shops can''t be added'; end if;
  if v_website is not null and v_website !~* '^https?://' then v_website := null; end if;

  insert into public.shops (external_id, name, lat, lng, address, website, phone, hours, locality, region, country_code)
  values (
    p_external_id, left(p_name, 200), p_lat, p_lng,
    left(nullif(btrim(p_address), ''), 300), left(v_website, 500), left(nullif(btrim(p_phone), ''), 50),
    left(nullif(btrim(p_hours), ''), 500), left(nullif(btrim(p_locality), ''), 100), left(nullif(btrim(p_region), ''), 100),
    upper(left(nullif(btrim(p_country_code), ''), 2))
  )
  on conflict (external_id) where external_id is not null do update set name = shops.name
  returning id into v_shop_id;
  return v_shop_id;
end;
$$;
revoke all on function public.ensure_shop(text, text, double precision, double precision, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ensure_shop(text, text, double precision, double precision, text, text, text, text, text, text, text) to authenticated;

-- Trigger functions aren't API (as 0012/0013).
revoke all on function public.guard_list_write() from public, anon, authenticated;
revoke all on function public.place_list_item() from public, anon, authenticated;
revoke all on function public.cap_list_items() from public, anon, authenticated;
