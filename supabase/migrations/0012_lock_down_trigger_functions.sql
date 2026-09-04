-- security-advisor fix: SECURITY DEFINER functions get PUBLIC EXECUTE by
-- Postgres's default grant, which Supabase auto-exposes as a callable RPC
-- endpoint. check_shop_promotion and handle_new_user are trigger-only and
-- should never be invoked directly by any client. log_shop_visit is meant
-- to be called by signed-in users only; 0011 already declared that intent
-- but the grant drifted out of sync with what's actually live — this
-- re-asserts it.
revoke all on function public.check_shop_promotion() from public;
revoke all on function public.handle_new_user() from public;

revoke all on function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date) from public;
grant execute on function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date) to authenticated;
