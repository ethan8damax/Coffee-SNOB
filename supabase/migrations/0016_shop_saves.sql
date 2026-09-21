-- Saved shops (D3): a private per-user bookmark list. Only the owner can read or change their saves.
create table public.shop_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);

alter table public.shop_saves enable row level security;

create policy "users manage their own shop saves" on public.shop_saves
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index shop_saves_user_created_idx on public.shop_saves (user_id, created_at desc);
