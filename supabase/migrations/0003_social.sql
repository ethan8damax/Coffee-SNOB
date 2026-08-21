create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  taste_picks text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  note text,
  visited_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.list_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid not null references public.lists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, list_id)
);

create table public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint no_self_follow check (follower_id <> followee_id)
);

alter table public.profiles enable row level security;
alter table public.logs enable row level security;
alter table public.list_saves enable row level security;
alter table public.follows enable row level security;

create policy "profiles are publicly readable" on public.profiles for select using (true);
create policy "users insert their own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "users update their own profile" on public.profiles for update using (auth.uid() = id);

create policy "logs are publicly readable" on public.logs for select using (true);
create policy "users manage their own logs" on public.logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "saves are publicly readable" on public.list_saves for select using (true);
create policy "users manage their own saves" on public.list_saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "follow graph is publicly readable" on public.follows for select using (true);
create policy "users manage their own follows" on public.follows for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

-- Keep lists.save_count denormalized so the site/app can display it without a join+count.
create or replace function public.handle_list_save_change()
returns trigger language plpgsql as $$
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

create trigger on_list_save_change
  after insert or delete on public.list_saves
  for each row execute function public.handle_list_save_change();

-- Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
