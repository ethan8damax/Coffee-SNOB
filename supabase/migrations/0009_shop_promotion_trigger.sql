-- Flags a shop for Snob-Approval review once our own users' logs cross a
-- log-count + average-rating bar (see docs/superpowers/specs/2026-09-03-
-- map-community-shops-design.md). This is a "worth a visit" signal, not
-- an approval — the two-visit human standard in CURATION-STANDARDS.md is
-- unchanged. min_logs/min_avg are named constants below so raising them
-- later, expected as the app grows, is a one-line change.
create or replace function public.check_shop_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_count integer;
  v_avg_rating numeric;
  v_min_logs constant integer := 5;
  v_min_avg constant numeric := 4.2;
begin
  select count(*), avg(rating) into v_log_count, v_avg_rating
  from public.logs
  where shop_id = new.shop_id;

  if v_log_count >= v_min_logs and v_avg_rating >= v_min_avg then
    update public.shops
    set promotion_status = 'flagged'
    where id = new.shop_id
      and promotion_status = 'none'
      and not exists (select 1 from public.shop_curations where shop_id = new.shop_id);
  end if;

  return new;
end;
$$;

create trigger on_log_insert_check_promotion
  after insert on public.logs
  for each row execute function public.check_shop_promotion();
