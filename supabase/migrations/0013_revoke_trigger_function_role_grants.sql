-- 0012 revoked from PUBLIC, but Supabase's project template grants EXECUTE
-- on new public-schema functions directly to anon/authenticated/service_role
-- via ALTER DEFAULT PRIVILEGES at creation time — a separate grant that
-- surviving a `revoke ... from public` and needs revoking from those roles
-- by name.
revoke all on function public.check_shop_promotion() from anon, authenticated;
revoke all on function public.handle_new_user() from anon, authenticated;

revoke all on function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date) from anon, authenticated;
grant execute on function public.log_shop_visit(text, text, double precision, double precision, smallint, text, date) to authenticated;
