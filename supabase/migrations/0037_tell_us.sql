-- Tell us (spec 2026-09-30-tell-us-design.md): one place to report a shop,
-- send a bug, an idea, or a message, and see where each one stands.

-- ── shop reports: any shop, more reasons, a note, an outcome ─────────────
-- A report is about an index café (place_id) or a shop in our table (shop_id),
-- never both. The index hide rules below only ever read place_id reports.
alter table public.place_flags
  alter column place_id drop not null,
  add column shop_id uuid references public.shops (id) on delete cascade,
  add column note text check (char_length(note) <= 500),
  add column outcome text check (outcome in ('done', 'passed')),
  add column reason text check (char_length(reason) <= 300),
  drop constraint place_flags_kind_check,
  add constraint place_flags_kind_check check (kind in ('closed', 'not_specialty', 'wrong_location', 'wrong_info', 'duplicate', 'other')),
  add constraint place_flags_target check ((place_id is null) <> (shop_id is null)),
  add constraint place_flags_shop_id_user_id_kind_key unique (shop_id, user_id, kind);
create index place_flags_shop_open_idx on public.place_flags (shop_id) where resolved_at is null;

-- Senders can't file a report that is already decided.
drop policy "active users flag places" on public.place_flags;
create policy "active users flag places" on public.place_flags for insert
  with check (user_id = (select auth.uid()) and public.is_active() and resolved_at is null and outcome is null and reason is null);

create or replace function public.active_place_hides()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select place_id from public.place_overrides where action = 'hide'
  union
  select place_id from public.place_flags
  where kind = 'closed' and resolved_at is null and place_id is not null
  group by place_id having count(distinct user_id) >= 2;
$$;

create or replace function public.place_flag_counts()
returns table (place_id text, not_specialty integer)
language sql
stable
security definer
set search_path = public
as $$
  select place_id, count(distinct user_id)::integer
  from public.place_flags
  where kind = 'not_specialty' and resolved_at is null and place_id is not null
  group by place_id;
$$;

-- ── messages: bugs, ideas, and anything else ─────────────────────────────
-- context: what the app attaches (platform, version, screen), never typed by hand.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('bug', 'idea', 'contact')),
  body text not null check (char_length(body) between 1 and 2000),
  context jsonb not null default '{}' check (jsonb_typeof(context) = 'object' and pg_column_size(context) <= 2000),
  status text not null default 'sent' check (status in ('sent', 'seen', 'done', 'passed')),
  reason text check (char_length(reason) <= 300),
  seen_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_user_idx on public.messages (user_id, created_at);
create index messages_open_idx on public.messages (created_at) where status in ('sent', 'seen');
create index messages_decided_by_idx on public.messages (decided_by);

alter table public.messages enable row level security;
create policy "senders and admins read messages" on public.messages
  for select using (user_id = (select auth.uid()) or public.is_admin());
-- No insert/update/delete policies: writes go through the functions below.

-- ── notifications learn four kinds ───────────────────────────────────────
alter table public.notifications
  add column flag_id uuid references public.place_flags (id) on delete cascade,
  add column message_id uuid references public.messages (id) on delete cascade,
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check check (kind in (
    'snob_approved', 'shop_added', 'shop_declined', 'report_done', 'report_passed', 'message_done', 'message_passed'
  )),
  drop constraint notifications_target,
  add constraint notifications_target check (shop_id is not null or submission_id is not null or flag_id is not null or message_id is not null);
create index notifications_flag_idx on public.notifications (flag_id);
create index notifications_message_idx on public.notifications (message_id);

-- ── send a message ───────────────────────────────────────────────────────
create or replace function public.send_message(p_kind text, p_body text, p_context jsonb default '{}')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'must be signed in'; end if;
  if not public.is_active() then raise exception 'account is suspended'; end if;
  if char_length(btrim(coalesce(p_body, ''))) = 0 then raise exception 'a message needs words'; end if;
  if not public.is_admin() and (select count(*) from public.messages
      where user_id = auth.uid() and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'too many messages today';
  end if;
  insert into public.messages (user_id, kind, body, context)
  values (auth.uid(), p_kind, left(btrim(p_body), 2000), coalesce(p_context, '{}'))
  returning id into v_id;
  return v_id;
end;
$$;

-- ── admin: seen, decided, and who to email back ──────────────────────────
create or replace function public.mark_message_seen(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  update public.messages set status = 'seen', seen_at = now() where id = p_id and status = 'sent';
end;
$$;

create or replace function public.decide_message(p_id uuid, p_outcome text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_outcome not in ('done', 'passed') then raise exception 'outcome is done or passed'; end if;
  update public.messages
    set status = p_outcome, reason = left(nullif(btrim(p_reason), ''), 300),
        seen_at = coalesce(seen_at, now()), decided_by = auth.uid(), decided_at = now()
    where id = p_id and status in ('sent', 'seen')
    returning user_id into v_user;
  if v_user is null then raise exception 'message not found or already decided'; end if;
  if v_user <> auth.uid() then
    insert into public.notifications (user_id, kind, message_id) values (v_user, 'message_' || p_outcome, p_id);
  end if;
end;
$$;

create or replace function public.message_sender_email(p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return (select u.email from auth.users u join public.messages m on m.user_id = u.id where m.id = p_id);
end;
$$;

-- ── admin: decide every open report on one place or shop ─────────────────
-- Each person who reported it gets one note, whatever they reported.
create or replace function public.decide_place_flags(p_place_id text, p_shop_id uuid, p_outcome text, p_reason text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_outcome not in ('done', 'passed') then raise exception 'outcome is done or passed'; end if;
  if (p_place_id is null) = (p_shop_id is null) then raise exception 'one place or one shop'; end if;
  with decided as (
    update public.place_flags
      set resolved_at = now(), outcome = p_outcome, reason = left(nullif(btrim(p_reason), ''), 300)
      where resolved_at is null and (place_id = p_place_id or shop_id = p_shop_id)
      returning id, user_id, created_at
  ), firsts as (
    select distinct on (user_id) id, user_id from decided order by user_id, created_at
  ), notified as (
    insert into public.notifications (user_id, kind, flag_id)
    select user_id, 'report_' || p_outcome, id from firsts where user_id <> auth.uid()
  )
  select count(*) into v_count from decided;
  return v_count;
end;
$$;

revoke all on function public.send_message(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.mark_message_seen(uuid) from public, anon, authenticated;
revoke all on function public.decide_message(uuid, text, text) from public, anon, authenticated;
revoke all on function public.message_sender_email(uuid) from public, anon, authenticated;
revoke all on function public.decide_place_flags(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.send_message(text, text, jsonb) to authenticated;
grant execute on function public.mark_message_seen(uuid) to authenticated;
grant execute on function public.decide_message(uuid, text, text) to authenticated;
grant execute on function public.message_sender_email(uuid) to authenticated;
grant execute on function public.decide_place_flags(text, uuid, text, text) to authenticated;
