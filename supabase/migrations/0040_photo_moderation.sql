-- Photos Phase 3 (docs/superpowers/specs/2026-09-30-photos-phase-3-moderation-design.md):
-- two reports hide a photo until an admin decides; decide_photo keeps or removes
-- it, resolves the reports and tells each reporter.
--
-- Rollback:
--   drop trigger photo_flags_hide on public.photo_flags;
--   drop function public.hide_reported_photo(), public.decide_photo(uuid, text);
--   alter table public.photo_flags drop column outcome;
--   alter table public.notifications drop constraint notifications_kind_check,
--     add constraint notifications_kind_check check (kind in (
--       'snob_approved', 'shop_added', 'shop_declined', 'report_done', 'report_passed', 'message_done', 'message_passed'));
--   (delete any photo_kept / photo_removed notifications first)

alter table public.photo_flags
  add column outcome text check (outcome in ('kept', 'removed'));

alter table public.notifications
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check check (kind in (
    'snob_approved', 'shop_added', 'shop_declined', 'report_done', 'report_passed', 'message_done', 'message_passed',
    'photo_kept', 'photo_removed'
  ));

-- ── Two open reports hide a live photo ───────────────────────────────────
-- (photo_id, user_id) is unique, so two reports are two people. Security
-- definer: reporters can't update photos themselves.
create or replace function public.hide_reported_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.photo_flags where photo_id = new.photo_id and resolved_at is null) >= 2 then
    update public.log_photos set status = 'hidden' where id = new.photo_id and status = 'live';
  end if;
  return new;
end;
$$;
revoke all on function public.hide_reported_photo() from public, anon, authenticated;

create trigger photo_flags_hide after insert on public.photo_flags
  for each row execute function public.hide_reported_photo();

-- ── The admin's call ─────────────────────────────────────────────────────
-- kept: back to live. removed: taken down and unpinned (the nightly cleanup
-- deletes its files). Either way the open reports resolve and each reporter
-- hears once. Works with no reports, for taking a photo down from the shop view.
create or replace function public.decide_photo(p_photo_id uuid, p_outcome text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop uuid;
  v_count integer;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_outcome not in ('kept', 'removed') then raise exception 'outcome is kept or removed'; end if;

  update public.log_photos set status = case p_outcome when 'kept' then 'live' else 'removed' end
    where id = p_photo_id
    returning shop_id into v_shop;
  if v_shop is null then raise exception 'no such photo'; end if;
  if p_outcome = 'removed' then
    update public.shops set header_photo_id = null where header_photo_id = p_photo_id;
  end if;

  with decided as (
    update public.photo_flags set resolved_at = now(), outcome = p_outcome
      where photo_id = p_photo_id and resolved_at is null
      returning user_id
  ), notified as (
    insert into public.notifications (user_id, kind, shop_id)
    select distinct user_id, 'photo_' || p_outcome, v_shop from decided where user_id <> auth.uid()
  )
  select count(*) into v_count from decided;
  return v_count;
end;
$$;
revoke all on function public.decide_photo(uuid, text) from public, anon, authenticated;
grant execute on function public.decide_photo(uuid, text) to authenticated;
