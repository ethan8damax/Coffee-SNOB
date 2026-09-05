-- Home feed likes and comments (see docs/superpowers/specs/2026-09-05-
-- home-feed-and-comments-design.md). log_likes backs the heart on a log
-- entry itself; comments/comment_likes back the inline comment thread
-- (one level of replies, one like per user per comment).

create table public.log_likes (
  log_id uuid not null references public.logs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (log_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.logs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- Postgres CHECK constraints can't contain subqueries, so "a reply's parent
-- must itself be a top-level comment" (nesting stops at one level) is
-- enforced with a trigger instead. Not security definer — comments are
-- already publicly readable (policy below), so this needs no elevated
-- privilege and doesn't need the revoke-from-anon treatment 0012/0013 gave
-- the security-definer trigger functions.
create or replace function public.enforce_one_level_comment_replies()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.parent_comment_id is not null and exists (
    select 1 from public.comments where id = new.parent_comment_id and parent_comment_id is not null
  ) then
    raise exception 'cannot reply to a reply — comments nest one level deep';
  end if;
  return new;
end;
$$;

create trigger on_comment_insert_check_depth
  before insert on public.comments
  for each row execute function public.enforce_one_level_comment_replies();

create table public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.log_likes enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;

create policy "log likes are publicly readable" on public.log_likes for select using (true);
create policy "users manage their own log likes" on public.log_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "comments are publicly readable" on public.comments for select using (true);
create policy "users manage their own comments" on public.comments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "comment likes are publicly readable" on public.comment_likes for select using (true);
create policy "users manage their own comment likes" on public.comment_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Supports the feed's per-log comment-count and per-shop-set lookups.
create index comments_log_id_idx on public.comments (log_id);
create index comments_parent_comment_id_idx on public.comments (parent_comment_id);
