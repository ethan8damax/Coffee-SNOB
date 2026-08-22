-- Bookmarks/saves are private by default — nothing in the product requires
-- showing who saved a list (the aggregate save_count is already public via
-- lists.save_count), so drop the public-read policy and rely on the existing
-- user-scoped "for all" policy.
drop policy if exists "saves are publicly readable" on public.list_saves;

-- Pin search_path on the trigger function (Supabase advisor flagged this as
-- mutable, same fix already applied to handle_new_user).
create or replace function public.handle_list_save_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.lists set save_count = save_count + 1 where id = new.list_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.lists set save_count = greatest(save_count - 1, 0) where id = old.list_id;
    return old;
  end if;
  return null;
end;
$$;
