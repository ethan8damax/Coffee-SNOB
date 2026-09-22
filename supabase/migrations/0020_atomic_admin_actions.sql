-- Converts setUserStatus/setUserAdmin (packages/supabase/src/queries.ts) from two
-- independent Supabase round-trips into one atomic call each, per code review on
-- 0019_admin_user_management.sql's setUserStatus/setUserAdmin: an update-then-insert
-- across two separate calls means an insert failure after a successful update leaves
-- the profile change applied but unaudited, with nothing else in the schema recording
-- who changed is_admin/status or when.
--
-- Unlike log_shop_visit (security definer, because it needs to write shops — a table
-- regular users have no direct policy for), these are plain plpgsql, NOT security
-- definer: an admin caller already has RLS permission for both inner writes (migration
-- 0019's "admins update any profile" and "admins insert admin_actions" policies) — the
-- only thing missing was atomicity, not privilege. Running as the caller's own role
-- means RLS on both inner statements applies exactly as if the caller ran them
-- directly: a non-admin targeting their own row hits protect_privileged_profile_
-- columns_trigger; a non-admin targeting someone else's row updates 0 rows (RLS-
-- filtered, not an error) and then fails on the admin_actions insert's RLS check
-- (is_admin() is false) — either way the whole call rolls back, nothing is silently
-- partial. actor_id comes from auth.uid() internally rather than a parameter, so
-- there's nothing for a caller to lie about.

create or replace function public.admin_set_user_status(p_target_user_id uuid, p_status text)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_status not in ('active', 'suspended') then
    raise exception 'invalid status: %', p_status;
  end if;

  update public.profiles set status = p_status where id = p_target_user_id;

  insert into public.admin_actions (actor_id, target_user_id, action)
  values (auth.uid(), p_target_user_id, case when p_status = 'suspended' then 'suspend' else 'reactivate' end);
end;
$$;

-- Supabase's project template grants EXECUTE on new public-schema functions directly to
-- anon/authenticated/service_role via ALTER DEFAULT PRIVILEGES at creation time — a grant
-- that survives `revoke ... from public` and needs revoking from those roles by name (see
-- 0013_revoke_trigger_function_role_grants.sql).
revoke all on function public.admin_set_user_status(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;

create or replace function public.admin_set_user_admin(p_target_user_id uuid, p_is_admin boolean)
returns void
language plpgsql
set search_path = public
as $$
begin
  update public.profiles set is_admin = p_is_admin where id = p_target_user_id;

  insert into public.admin_actions (actor_id, target_user_id, action)
  values (auth.uid(), p_target_user_id, case when p_is_admin then 'grant_admin' else 'revoke_admin' end);
end;
$$;

revoke all on function public.admin_set_user_admin(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_user_admin(uuid, boolean) to authenticated;
