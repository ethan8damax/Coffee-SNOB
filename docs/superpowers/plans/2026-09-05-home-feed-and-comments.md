# Home Feed & Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Home tab's three-tab feed (Following / Nearby / Guides) with real Supabase data, and an inline comment thread (one level of replies, likes) on log entries — per `docs/superpowers/specs/2026-09-05-home-feed-and-comments-design.md`.

**Architecture:** Three new tables (`log_likes`, `comments`, `comment_likes`) back the feed's real engagement. Every feed/lookup query follows this codebase's existing "fetch base rows, then fetch related lookups (profiles/cities) by collected ids, merge client-side" pattern (see `getCitiesWithShopCounts`) rather than relational embeds across tables that aren't directly foreign-keyed to each other (`logs.user_id`/`lists.curator_id` both point at `auth.users`, not `profiles`, so `profiles` can't be embedded from either — it's always a separate `getProfilesByIds` call). Per-tab data-fetching hooks (framework glue, not unit tested, matching `useNearbyMapData`) call these queries and hand fully-assembled `FeedItem`s to dumb card components. Two pure/tested modules sit between the hooks and the query layer: `mergeFeedItems` (interleave+sort logs/lists by recency) and `buildCommentTree` (nest one level of replies).

**Tech Stack:** Postgres/Supabase (migration, RLS, plpgsql trigger), `@coffeesnob/supabase` (typed queries), Expo Router / React Native, `react-native-svg`, Vitest.

**Out of scope (see spec):** tagging/mentions, the notification system, photo upload, shop/guide/collection detail screens, the Lists tab.

---

### Task 1: Migration — `log_likes`, `comments`, `comment_likes`

**Files:**
- Create: `supabase/migrations/0014_home_feed_likes_and_comments.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply the migration to the dev database and verify**

Run: `psql "$DEV_DATABASE_URL" -f supabase/migrations/0014_home_feed_likes_and_comments.sql`

Then verify:
```bash
psql "$DEV_DATABASE_URL" -c "\d public.log_likes" -c "\d public.comments" -c "\d public.comment_likes"
```
Expected: all three tables listed with the columns above; `comments` shows the `on_comment_insert_check_depth` trigger.

Verify the depth trigger actually rejects a reply-to-a-reply. This needs a real log row to attach comments to, so create and clean up a throwaway one:
```bash
psql "$DEV_DATABASE_URL" <<'SQL'
do $$
declare
  v_user_id uuid;
  v_shop_id uuid;
  v_log_id uuid;
  v_top_id uuid;
  v_reply_id uuid;
begin
  select id into v_user_id from auth.users limit 1;
  insert into public.shops (name) values ('Depth Test Shop') returning id into v_shop_id;
  insert into public.logs (user_id, shop_id, rating) values (v_user_id, v_shop_id, 4) returning id into v_log_id;
  insert into public.comments (log_id, user_id, body) values (v_log_id, v_user_id, 'top level') returning id into v_top_id;
  insert into public.comments (log_id, user_id, parent_comment_id, body) values (v_log_id, v_user_id, v_top_id, 'a reply') returning id into v_reply_id;
  begin
    insert into public.comments (log_id, user_id, parent_comment_id, body) values (v_log_id, v_user_id, v_reply_id, 'reply to a reply');
    raise exception 'expected the depth trigger to reject this insert';
  exception when others then
    raise notice 'depth trigger correctly rejected: %', sqlerrm;
  end;
  delete from public.shops where id = v_shop_id;
end $$;
SQL
```
Expected: a `NOTICE: depth trigger correctly rejected: cannot reply to a reply — comments nest one level deep`. The final `delete from shops` cascades to remove the test log and comments too.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0014_home_feed_likes_and_comments.sql
git commit -m "feat: add log_likes, comments, comment_likes tables"
```

---

### Task 2: Update `packages/supabase/src/types.ts`

**Files:**
- Modify: `packages/supabase/src/types.ts`

- [ ] **Step 1: Add the three new table types**

Insert `comment_likes` and `comments` alphabetically after `cities` (before `follows`, line 46 in the current file):

```ts
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          created_at: string
          id: string
          log_id: string
          parent_comment_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          log_id: string
          parent_comment_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          log_id?: string
          parent_comment_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
```

And insert `log_likes` alphabetically right before `logs` (`log_likes` sorts before `logs` — `_` < `s`):

```ts
      log_likes: {
        Row: {
          created_at: string
          log_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          log_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          log_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_likes_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "logs"
            referencedColumns: ["id"]
          },
        ]
      }
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @coffeesnob/supabase typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/supabase/src/types.ts
git commit -m "feat: add log_likes/comments/comment_likes types"
```

---

### Task 3: Query layer — profile/city lookups and likes

**Files:**
- Modify: `packages/supabase/src/queries.ts`
- Modify: `packages/supabase/test/queries.test.ts`

Every feed query needs to resolve `user_id`/`curator_id` to a display name and (for city guides) `city_id` to a city name. Neither `logs.user_id` nor `lists.curator_id` has a direct foreign key to `profiles` (both point at `auth.users`, same as `profiles.id` — PostgREST can't embed across two tables that merely share a target, only across a direct FK between the two tables in the query), so this is always a separate lookup by id, exactly like `getCitiesWithShopCounts` already does for `list_items`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/supabase/test/queries.test.ts` (add `getProfilesByIds, getCitiesByIds, getLogLikes, setLogLike` to the existing import line at the top):

```ts
describe("getProfilesByIds", () => {
  it("returns an empty array without querying when given no ids", async () => {
    const fromSpy = vi.fn();
    const client = { from: fromSpy } as any;
    expect(await getProfilesByIds(client, [])).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("queries profiles by id", async () => {
    const inSpy = vi.fn(() => Promise.resolve({ data: [{ id: "u1", username: "mara", display_name: "Mara K.", avatar_url: null }], error: null }));
    const selectSpy = vi.fn(() => ({ in: inSpy }));
    const client = { from: () => ({ select: selectSpy }) } as any;

    const profiles = await getProfilesByIds(client, ["u1"]);

    expect(profiles).toEqual([{ id: "u1", username: "mara", display_name: "Mara K.", avatar_url: null }]);
    expect(selectSpy).toHaveBeenCalledWith("id, username, display_name, avatar_url");
    expect(inSpy).toHaveBeenCalledWith("id", ["u1"]);
  });

  it("throws when the client returns an error", async () => {
    const client = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: null, error: new Error("boom") }) }) }) } as any;
    await expect(getProfilesByIds(client, ["u1"])).rejects.toThrow("boom");
  });
});

describe("getCitiesByIds", () => {
  it("returns an empty array without querying when given no ids", async () => {
    const fromSpy = vi.fn();
    const client = { from: fromSpy } as any;
    expect(await getCitiesByIds(client, [])).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("queries cities by id", async () => {
    const inSpy = vi.fn(() => Promise.resolve({ data: [{ id: "c1", name: "Berlin" }], error: null }));
    const client = { from: () => ({ select: () => ({ in: inSpy }) }) } as any;
    expect(await getCitiesByIds(client, ["c1"])).toEqual([{ id: "c1", name: "Berlin" }]);
    expect(inSpy).toHaveBeenCalledWith("id", ["c1"]);
  });
});

describe("getLogLikes", () => {
  it("returns an empty array without querying when given no log ids", async () => {
    const fromSpy = vi.fn();
    const client = { from: fromSpy } as any;
    expect(await getLogLikes(client, [])).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("queries log_likes for the given log ids", async () => {
    const inSpy = vi.fn(() => Promise.resolve({ data: [{ log_id: "l1", user_id: "u1" }], error: null }));
    const client = { from: () => ({ select: () => ({ in: inSpy }) }) } as any;
    expect(await getLogLikes(client, ["l1"])).toEqual([{ log_id: "l1", user_id: "u1" }]);
    expect(inSpy).toHaveBeenCalledWith("log_id", ["l1"]);
  });
});

describe("setLogLike", () => {
  it("inserts a row when liked is true", async () => {
    const insertSpy = vi.fn(() => Promise.resolve({ error: null }));
    const client = { from: () => ({ insert: insertSpy }) } as any;
    await setLogLike(client, "l1", "u1", true);
    expect(insertSpy).toHaveBeenCalledWith({ log_id: "l1", user_id: "u1" });
  });

  it("deletes the row when liked is false", async () => {
    const eqSpy2 = vi.fn(() => Promise.resolve({ error: null }));
    const eqSpy1 = vi.fn(() => ({ eq: eqSpy2 }));
    const deleteSpy = vi.fn(() => ({ eq: eqSpy1 }));
    const client = { from: () => ({ delete: deleteSpy }) } as any;
    await setLogLike(client, "l1", "u1", false);
    expect(eqSpy1).toHaveBeenCalledWith("log_id", "l1");
    expect(eqSpy2).toHaveBeenCalledWith("user_id", "u1");
  });

  it("throws when the insert errors", async () => {
    const client = { from: () => ({ insert: () => Promise.resolve({ error: new Error("boom") }) }) } as any;
    await expect(setLogLike(client, "l1", "u1", true)).rejects.toThrow("boom");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @coffeesnob/supabase test`
Expected: FAIL — `getProfilesByIds`, `getCitiesByIds`, `getLogLikes`, `setLogLike` are not exported.

- [ ] **Step 3: Implement**

Append to `packages/supabase/src/queries.ts`:

```ts
export async function getProfilesByIds(client: Client, ids: string[]) {
  if (ids.length === 0) return [];
  const { data, error } = await client
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", ids);
  if (error) throw error;
  return data;
}

export async function getCitiesByIds(client: Client, ids: string[]) {
  if (ids.length === 0) return [];
  const { data, error } = await client.from("cities").select("id, name").in("id", ids);
  if (error) throw error;
  return data;
}

export async function getLogLikes(client: Client, logIds: string[]) {
  if (logIds.length === 0) return [];
  const { data, error } = await client.from("log_likes").select("log_id, user_id").in("log_id", logIds);
  if (error) throw error;
  return data;
}

export async function setLogLike(client: Client, logId: string, userId: string, liked: boolean) {
  if (liked) {
    const { error } = await client.from("log_likes").insert({ log_id: logId, user_id: userId });
    if (error) throw error;
  } else {
    const { error } = await client.from("log_likes").delete().eq("log_id", logId).eq("user_id", userId);
    if (error) throw error;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @coffeesnob/supabase test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/src/queries.ts packages/supabase/test/queries.test.ts
git commit -m "feat: add profile/city lookup and log-like queries"
```

---

### Task 4: Query layer — comments

**Files:**
- Modify: `packages/supabase/src/queries.ts`
- Modify: `packages/supabase/test/queries.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/supabase/test/queries.test.ts` (add `getComments, getCommentLikes, setCommentLike, postComment, getCommentCountsByLog` to the import):

```ts
describe("getComments", () => {
  it("queries comments for a log ordered oldest first", async () => {
    const orderSpy = vi.fn(() => Promise.resolve({ data: [{ id: "c1", parent_comment_id: null, user_id: "u1", body: "hi", created_at: "t1" }], error: null }));
    const eqSpy = vi.fn(() => ({ order: orderSpy }));
    const selectSpy = vi.fn(() => ({ eq: eqSpy }));
    const client = { from: () => ({ select: selectSpy }) } as any;

    const comments = await getComments(client, "l1");

    expect(comments).toEqual([{ id: "c1", parent_comment_id: null, user_id: "u1", body: "hi", created_at: "t1" }]);
    expect(eqSpy).toHaveBeenCalledWith("log_id", "l1");
    expect(orderSpy).toHaveBeenCalledWith("created_at", { ascending: true });
  });
});

describe("getCommentLikes", () => {
  it("returns an empty array without querying when given no comment ids", async () => {
    const fromSpy = vi.fn();
    const client = { from: fromSpy } as any;
    expect(await getCommentLikes(client, [])).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("queries comment_likes for the given comment ids", async () => {
    const inSpy = vi.fn(() => Promise.resolve({ data: [{ comment_id: "c1", user_id: "u1" }], error: null }));
    const client = { from: () => ({ select: () => ({ in: inSpy }) }) } as any;
    expect(await getCommentLikes(client, ["c1"])).toEqual([{ comment_id: "c1", user_id: "u1" }]);
  });
});

describe("setCommentLike", () => {
  it("inserts a row when liked is true", async () => {
    const insertSpy = vi.fn(() => Promise.resolve({ error: null }));
    const client = { from: () => ({ insert: insertSpy }) } as any;
    await setCommentLike(client, "c1", "u1", true);
    expect(insertSpy).toHaveBeenCalledWith({ comment_id: "c1", user_id: "u1" });
  });

  it("deletes the row when liked is false", async () => {
    const eqSpy2 = vi.fn(() => Promise.resolve({ error: null }));
    const eqSpy1 = vi.fn(() => ({ eq: eqSpy2 }));
    const client = { from: () => ({ delete: () => ({ eq: eqSpy1 }) }) } as any;
    await setCommentLike(client, "c1", "u1", false);
    expect(eqSpy1).toHaveBeenCalledWith("comment_id", "c1");
    expect(eqSpy2).toHaveBeenCalledWith("user_id", "u1");
  });
});

describe("postComment", () => {
  it("inserts a comment and returns the created row", async () => {
    const singleSpy = vi.fn(() => Promise.resolve({ data: { id: "c1", log_id: "l1", user_id: "u1", parent_comment_id: null, body: "hi", created_at: "t1" }, error: null }));
    const selectSpy = vi.fn(() => ({ single: singleSpy }));
    const insertSpy = vi.fn(() => ({ select: selectSpy }));
    const client = { from: () => ({ insert: insertSpy }) } as any;

    const comment = await postComment(client, { logId: "l1", userId: "u1", body: "hi" });

    expect(comment).toEqual({ id: "c1", log_id: "l1", user_id: "u1", parent_comment_id: null, body: "hi", created_at: "t1" });
    expect(insertSpy).toHaveBeenCalledWith({ log_id: "l1", user_id: "u1", body: "hi", parent_comment_id: null });
  });

  it("passes parentCommentId through when replying", async () => {
    const singleSpy = vi.fn(() => Promise.resolve({ data: {}, error: null }));
    const insertSpy = vi.fn(() => ({ select: () => ({ single: singleSpy }) }));
    const client = { from: () => ({ insert: insertSpy }) } as any;

    await postComment(client, { logId: "l1", userId: "u1", body: "reply", parentCommentId: "c1" });

    expect(insertSpy).toHaveBeenCalledWith({ log_id: "l1", user_id: "u1", body: "reply", parent_comment_id: "c1" });
  });

  it("throws when the insert errors", async () => {
    const client = { from: () => ({ insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: new Error("cannot reply to a reply") }) }) }) }) } as any;
    await expect(postComment(client, { logId: "l1", userId: "u1", body: "x", parentCommentId: "c2" })).rejects.toThrow("cannot reply to a reply");
  });
});

describe("getCommentCountsByLog", () => {
  it("returns an empty array without querying when given no log ids", async () => {
    const fromSpy = vi.fn();
    const client = { from: fromSpy } as any;
    expect(await getCommentCountsByLog(client, [])).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("queries comment log_ids for the given log ids", async () => {
    const inSpy = vi.fn(() => Promise.resolve({ data: [{ log_id: "l1" }, { log_id: "l1" }], error: null }));
    const client = { from: () => ({ select: () => ({ in: inSpy }) }) } as any;
    expect(await getCommentCountsByLog(client, ["l1"])).toEqual([{ log_id: "l1" }, { log_id: "l1" }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @coffeesnob/supabase test`
Expected: FAIL — the five functions are not exported.

- [ ] **Step 3: Implement**

Append to `packages/supabase/src/queries.ts`:

```ts
export async function getComments(client: Client, logId: string) {
  const { data, error } = await client
    .from("comments")
    .select("id, parent_comment_id, user_id, body, created_at")
    .eq("log_id", logId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getCommentLikes(client: Client, commentIds: string[]) {
  if (commentIds.length === 0) return [];
  const { data, error } = await client.from("comment_likes").select("comment_id, user_id").in("comment_id", commentIds);
  if (error) throw error;
  return data;
}

export async function setCommentLike(client: Client, commentId: string, userId: string, liked: boolean) {
  if (liked) {
    const { error } = await client.from("comment_likes").insert({ comment_id: commentId, user_id: userId });
    if (error) throw error;
  } else {
    const { error } = await client.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", userId);
    if (error) throw error;
  }
}

export async function postComment(
  client: Client,
  params: { logId: string; userId: string; body: string; parentCommentId?: string }
) {
  const { data, error } = await client
    .from("comments")
    .insert({ log_id: params.logId, user_id: params.userId, body: params.body, parent_comment_id: params.parentCommentId ?? null })
    .select("id, log_id, parent_comment_id, user_id, body, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function getCommentCountsByLog(client: Client, logIds: string[]) {
  if (logIds.length === 0) return [];
  const { data, error } = await client.from("comments").select("log_id").in("log_id", logIds);
  if (error) throw error;
  return data;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @coffeesnob/supabase test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/src/queries.ts packages/supabase/test/queries.test.ts
git commit -m "feat: add comment queries"
```

---

### Task 5: Query layer — feed fetching (Following / Nearby / Guides)

**Files:**
- Modify: `packages/supabase/src/queries.ts`
- Modify: `packages/supabase/test/queries.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/supabase/test/queries.test.ts` (add `getFollowedUserIds, getFollowingFeedLogs, getFollowingFeedLists, getShopsInBounds, getLogsForShops, getLiveCityGuides` to the import):

```ts
describe("getFollowedUserIds", () => {
  it("returns the followee ids for a follower", async () => {
    const eqSpy = vi.fn(() => Promise.resolve({ data: [{ followee_id: "u2" }, { followee_id: "u3" }], error: null }));
    const client = { from: () => ({ select: () => ({ eq: eqSpy }) }) } as any;
    expect(await getFollowedUserIds(client, "u1")).toEqual(["u2", "u3"]);
    expect(eqSpy).toHaveBeenCalledWith("follower_id", "u1");
  });
});

describe("getFollowingFeedLogs", () => {
  it("returns an empty array without querying when given no followee ids", async () => {
    const fromSpy = vi.fn();
    const client = { from: fromSpy } as any;
    expect(await getFollowingFeedLogs(client, [])).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("queries logs from the given users, newest first, with shop details", async () => {
    const orderSpy = vi.fn(() => ({ limit: () => Promise.resolve({ data: [{ id: "l1", shops: { name: "Noi Coffee", neighborhood: "Príncipe Real" } }], error: null }) }));
    const inSpy = vi.fn(() => ({ order: orderSpy }));
    const selectSpy = vi.fn(() => ({ in: inSpy }));
    const client = { from: () => ({ select: selectSpy }) } as any;

    const logs = await getFollowingFeedLogs(client, ["u2"]);

    expect(logs).toEqual([{ id: "l1", shops: { name: "Noi Coffee", neighborhood: "Príncipe Real" } }]);
    expect(inSpy).toHaveBeenCalledWith("user_id", ["u2"]);
    expect(orderSpy).toHaveBeenCalledWith("created_at", { ascending: false });
  });
});

describe("getFollowingFeedLists", () => {
  it("includes editorial lists (curator_id is null) even with no followees", async () => {
    const orSpy = vi.fn(() => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }));
    const client = { from: () => ({ select: () => ({ or: orSpy }) }) } as any;

    await getFollowingFeedLists(client, []);

    expect(orSpy).toHaveBeenCalledWith("curator_id.is.null");
  });

  it("includes followees' lists when there are any", async () => {
    const orSpy = vi.fn(() => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }));
    const client = { from: () => ({ select: () => ({ or: orSpy }) }) } as any;

    await getFollowingFeedLists(client, ["u2", "u3"]);

    expect(orSpy).toHaveBeenCalledWith("curator_id.is.null,curator_id.in.(u2,u3)");
  });
});

describe("getShopsInBounds", () => {
  it("queries shops within the given lat/lng box", async () => {
    const geSpy = vi.fn(() => ({ lte: vi.fn(() => ({ gte: vi.fn(() => ({ lte: () => Promise.resolve({ data: [{ id: "s1", name: "Noi Coffee" }], error: null }) })) })) }));
    const client = { from: () => ({ select: () => ({ gte: geSpy }) }) } as any;

    const shops = await getShopsInBounds(client, { minLat: 38.7, maxLat: 38.8, minLng: -9.2, maxLng: -9.1 });

    expect(shops).toEqual([{ id: "s1", name: "Noi Coffee" }]);
  });
});

describe("getLogsForShops", () => {
  it("returns an empty array without querying when given no shop ids", async () => {
    const fromSpy = vi.fn();
    const client = { from: fromSpy } as any;
    expect(await getLogsForShops(client, [])).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("queries logs for the given shops, newest first", async () => {
    const orderSpy = vi.fn(() => ({ limit: () => Promise.resolve({ data: [{ id: "l1", shop_id: "s1" }], error: null }) }));
    const inSpy = vi.fn(() => ({ order: orderSpy }));
    const client = { from: () => ({ select: () => ({ in: inSpy }) }) } as any;

    expect(await getLogsForShops(client, ["s1"])).toEqual([{ id: "l1", shop_id: "s1" }]);
    expect(inSpy).toHaveBeenCalledWith("shop_id", ["s1"]);
  });
});

describe("getLiveCityGuides", () => {
  it("returns an empty array without querying lists when no cities are live", async () => {
    const client = {
      from: (table: string) => {
        if (table === "cities") return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
        throw new Error(`unexpected table ${table}`);
      },
    } as any;
    expect(await getLiveCityGuides(client)).toEqual([]);
  });

  it("queries city_guide lists in live cities and attaches the city name", async () => {
    const client = {
      from: (table: string) => {
        if (table === "cities") {
          return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: "c1", name: "Berlin" }], error: null }) }) };
        }
        if (table === "lists") {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: [{ id: "g1", title: "Six cups", city_id: "c1" }], error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as any;

    expect(await getLiveCityGuides(client)).toEqual([{ id: "g1", title: "Six cups", city_id: "c1", cityName: "Berlin" }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @coffeesnob/supabase test`
Expected: FAIL — the six functions are not exported.

- [ ] **Step 3: Implement**

Append to `packages/supabase/src/queries.ts`:

```ts
export async function getFollowedUserIds(client: Client, userId: string) {
  const { data, error } = await client.from("follows").select("followee_id").eq("follower_id", userId);
  if (error) throw error;
  return data.map((row) => row.followee_id);
}

export async function getFollowingFeedLogs(client: Client, followeeIds: string[]) {
  if (followeeIds.length === 0) return [];
  const { data, error } = await client
    .from("logs")
    .select("id, user_id, shop_id, rating, note, visited_at, created_at, shops(name, neighborhood)")
    .in("user_id", followeeIds)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

export async function getFollowingFeedLists(client: Client, followeeIds: string[]) {
  const orFilter =
    followeeIds.length > 0 ? `curator_id.is.null,curator_id.in.(${followeeIds.join(",")})` : "curator_id.is.null";
  const { data, error } = await client
    .from("lists")
    .select("id, slug, type, title, description, curator_id, city_id, cover_photo_alt, created_at, list_items(count)")
    .or(orFilter)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data;
}

export async function getShopsInBounds(
  client: Client,
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }
) {
  const { data, error } = await client
    .from("shops")
    .select("id, name, neighborhood, lat, lng")
    .gte("lat", bounds.minLat)
    .lte("lat", bounds.maxLat)
    .gte("lng", bounds.minLng)
    .lte("lng", bounds.maxLng);
  if (error) throw error;
  return data;
}

export async function getLogsForShops(client: Client, shopIds: string[]) {
  if (shopIds.length === 0) return [];
  const { data, error } = await client
    .from("logs")
    .select("id, user_id, shop_id, rating, note, visited_at, created_at")
    .in("shop_id", shopIds)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

export async function getLiveCityGuides(client: Client) {
  const { data: liveCities, error: citiesError } = await client.from("cities").select("id, name").eq("status", "live");
  if (citiesError) throw citiesError;
  if (liveCities.length === 0) return [];

  const { data, error } = await client
    .from("lists")
    .select("id, slug, title, description, cover_photo_alt, created_at, city_id, list_items(count)")
    .eq("type", "city_guide")
    .in(
      "city_id",
      liveCities.map((c) => c.id)
    )
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;

  const cityNameById = new Map(liveCities.map((c) => [c.id, c.name]));
  return data.map((guide) => ({ ...guide, cityName: cityNameById.get(guide.city_id as string) ?? null }));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @coffeesnob/supabase test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/src/queries.ts packages/supabase/test/queries.test.ts
git commit -m "feat: add feed queries for Following/Nearby/Guides tabs"
```

---

### Task 6: Pure logic — `FeedItem` type and `mergeFeedItems`

**Files:**
- Create: `apps/app/lib/feed/types.ts`
- Create: `apps/app/lib/feed/merge-feed-items.ts`
- Create: `apps/app/lib/feed/merge-feed-items.test.ts`

- [ ] **Step 1: Write the shared type**

`apps/app/lib/feed/types.ts`:
```ts
export type LogFeedCard = {
  type: "log";
  id: string;
  createdAt: string;
  userId: string;
  authorName: string;
  shopName: string;
  shopNeighborhood: string | null;
  rating: number;
  note: string | null;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
};

export type GuideFeedCard = {
  type: "guide";
  id: string;
  createdAt: string;
  title: string;
  description: string | null;
  cityName: string | null;
  shopCount: number;
};

export type CollectionFeedCard = {
  type: "collection";
  id: string;
  createdAt: string;
  title: string;
  description: string | null;
  curatorName: string;
  shopCount: number;
};

export type FeedItem = LogFeedCard | GuideFeedCard | CollectionFeedCard;
```

- [ ] **Step 2: Write the failing test**

`apps/app/lib/feed/merge-feed-items.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mergeFeedItems } from "./merge-feed-items";
import type { FeedItem } from "./types";

function log(id: string, createdAt: string): FeedItem {
  return {
    type: "log", id, createdAt, userId: "u1", authorName: "Mara K.", shopName: "Noi Coffee",
    shopNeighborhood: null, rating: 4, note: null, likeCount: 0, likedByMe: false, commentCount: 0,
  };
}
function guide(id: string, createdAt: string): FeedItem {
  return { type: "guide", id, createdAt, title: "Six cups", description: null, cityName: "Berlin", shopCount: 6 };
}

describe("mergeFeedItems", () => {
  it("interleaves multiple sources sorted by createdAt descending", () => {
    const result = mergeFeedItems([[log("l1", "2026-09-01T00:00:00Z")], [guide("g1", "2026-09-03T00:00:00Z"), guide("g2", "2026-08-01T00:00:00Z")]]);
    expect(result.map((r) => r.id)).toEqual(["g1", "l1", "g2"]);
  });

  it("returns an empty array when every source is empty", () => {
    expect(mergeFeedItems([[], []])).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter app test -- merge-feed-items`
Expected: FAIL — `./merge-feed-items` has no exported member `mergeFeedItems` (module doesn't exist yet).

- [ ] **Step 4: Implement**

`apps/app/lib/feed/merge-feed-items.ts`:
```ts
import type { FeedItem } from "./types";

export function mergeFeedItems(sources: FeedItem[][]): FeedItem[] {
  return sources.flat().sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter app test -- merge-feed-items`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/app/lib/feed/types.ts apps/app/lib/feed/merge-feed-items.ts apps/app/lib/feed/merge-feed-items.test.ts
git commit -m "feat: add FeedItem type and mergeFeedItems"
```

---

### Task 7: Pure logic — `buildCommentTree`

**Files:**
- Create: `apps/app/lib/feed/comment-tree.ts`
- Create: `apps/app/lib/feed/comment-tree.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildCommentTree, type CommentWithMeta } from "./comment-tree";

function comment(overrides: Partial<CommentWithMeta>): CommentWithMeta {
  return {
    id: "c1", parentCommentId: null, userId: "u1", body: "hi", createdAt: "2026-09-01T00:00:00Z",
    authorName: "Mara K.", likeCount: 0, likedByMe: false, ...overrides,
  };
}

describe("buildCommentTree", () => {
  it("nests a reply under its parent", () => {
    const top = comment({ id: "c1" });
    const reply = comment({ id: "c2", parentCommentId: "c1", createdAt: "2026-09-01T01:00:00Z" });

    const tree = buildCommentTree([top, reply]);

    expect(tree).toEqual([{ ...top, replies: [reply] }]);
  });

  it("orders replies to the same parent oldest first", () => {
    const top = comment({ id: "c1" });
    const replyLater = comment({ id: "c3", parentCommentId: "c1", createdAt: "2026-09-01T02:00:00Z" });
    const replyEarlier = comment({ id: "c2", parentCommentId: "c1", createdAt: "2026-09-01T01:00:00Z" });

    const tree = buildCommentTree([top, replyLater, replyEarlier]);

    expect(tree[0].replies.map((r) => r.id)).toEqual(["c2", "c3"]);
  });

  it("gives a top-level comment with no replies an empty replies array", () => {
    const top = comment({ id: "c1" });
    expect(buildCommentTree([top])).toEqual([{ ...top, replies: [] }]);
  });

  it("preserves top-level order as given", () => {
    const first = comment({ id: "c1" });
    const second = comment({ id: "c2" });
    expect(buildCommentTree([first, second]).map((c) => c.id)).toEqual(["c1", "c2"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter app test -- comment-tree`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement**

```ts
export type CommentWithMeta = {
  id: string;
  parentCommentId: string | null;
  userId: string;
  body: string;
  createdAt: string;
  authorName: string;
  likeCount: number;
  likedByMe: boolean;
};

export type CommentThreadItem = CommentWithMeta & { replies: CommentWithMeta[] };

export function buildCommentTree(comments: CommentWithMeta[]): CommentThreadItem[] {
  const repliesByParent = new Map<string, CommentWithMeta[]>();
  for (const c of comments) {
    if (c.parentCommentId === null) continue;
    const replies = repliesByParent.get(c.parentCommentId) ?? [];
    replies.push(c);
    repliesByParent.set(c.parentCommentId, replies);
  }

  return comments
    .filter((c) => c.parentCommentId === null)
    .map((c) => ({
      ...c,
      replies: (repliesByParent.get(c.id) ?? []).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter app test -- comment-tree`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/app/lib/feed/comment-tree.ts apps/app/lib/feed/comment-tree.test.ts
git commit -m "feat: add buildCommentTree"
```

---

### Task 8: Native `Detour` rating component

**Files:**
- Create: `apps/app/components/detour-style.ts`
- Create: `apps/app/components/detour-style.test.ts`
- Create: `apps/app/components/detour.tsx`

Mirrors `components/map/pin-style.ts` — the value-to-visual-style mapping is pulled into its own pure, tested function; the component itself is thin rendering glue.

- [ ] **Step 1: Write the failing test**

`apps/app/components/detour-style.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { colors } from "@coffeesnob/design-tokens";
import { detourStyleForValue, DETOUR_LABELS } from "./detour-style";

describe("detourStyleForValue", () => {
  it("uses oxblood-on-cream for a 5", () => {
    expect(detourStyleForValue(5)).toEqual({ background: colors.oxblood, chevron: colors.cream, text: colors.cream, border: colors.oxblood });
  });

  it("uses burnt-on-ink for a 4", () => {
    expect(detourStyleForValue(4)).toEqual({ background: colors.burnt, chevron: colors.ink, text: colors.ink, border: colors.burnt });
  });

  it("uses an outlined/muted style for 1-3", () => {
    expect(detourStyleForValue(3)).toEqual({ background: "transparent", chevron: colors.burnt, text: colors.ink, border: colors.ink3 });
    expect(detourStyleForValue(1)).toEqual({ background: "transparent", chevron: colors.burnt, text: colors.ink3, border: colors.ink3 });
  });

  it("clamps out-of-range values into 1-5", () => {
    expect(detourStyleForValue(9)).toEqual(detourStyleForValue(5));
    expect(detourStyleForValue(0)).toEqual(detourStyleForValue(1));
  });
});

describe("DETOUR_LABELS", () => {
  it("has one label per rating, matching the marketing site's copy", () => {
    expect(DETOUR_LABELS).toEqual(["Stay home", "On your way", "Worth the detour", "Make the trip", "Catch a flight"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter app test -- detour-style`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement**

`apps/app/components/detour-style.ts`:
```ts
import { colors } from "@coffeesnob/design-tokens";

export const DETOUR_LABELS = ["Stay home", "On your way", "Worth the detour", "Make the trip", "Catch a flight"];

export type DetourStyle = { background: string; chevron: string; text: string; border: string };

// Mirrors the marketing site's Detour chip (apps/web/components/primitives.tsx)
// and the map's pin tiering (components/map/pin-style.ts): 5 -> oxblood,
// 4 -> burnt, 1-3 -> outlined/muted, with 1 dimmed further.
export function detourStyleForValue(value: number): DetourStyle {
  const v = Math.max(1, Math.min(5, Math.round(value)));
  if (v === 5) return { background: colors.oxblood, chevron: colors.cream, text: colors.cream, border: colors.oxblood };
  if (v === 4) return { background: colors.burnt, chevron: colors.ink, text: colors.ink, border: colors.burnt };
  return { background: "transparent", chevron: colors.burnt, text: v === 1 ? colors.ink3 : colors.ink, border: colors.ink3 };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter app test -- detour-style`
Expected: PASS.

- [ ] **Step 5: Write the component**

`apps/app/components/detour.tsx`:
```tsx
import { View, Text } from "react-native";
import Svg, { Path } from "react-native-svg";
import { detourStyleForValue, DETOUR_LABELS } from "./detour-style";

function Chevron({ filled, color }: { filled: boolean; color: string }) {
  return (
    <Svg width={5.5} height={7} viewBox="0 0 9 11">
      <Path d="M1.5 1.5 6 5.5l-4.5 4" stroke={color} strokeOpacity={filled ? 1 : 0.32} strokeWidth={2.6} fill="none" />
    </Svg>
  );
}

export function Detour({ value }: { value: number }) {
  const v = Math.max(1, Math.min(5, Math.round(value)));
  const style = detourStyleForValue(v);
  return (
    <View
      style={{
        flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", height: 26,
        paddingHorizontal: 10, borderRadius: 2, borderWidth: 1, borderColor: style.border, backgroundColor: style.background,
      }}
    >
      <View style={{ flexDirection: "row", gap: 1.5 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Chevron key={i} filled={i <= v} color={style.chevron} />
        ))}
      </View>
      <Text style={{ fontFamily: "AreaExtended-Bold", fontSize: 8.5, letterSpacing: 1.19, textTransform: "uppercase", color: style.text }}>
        {DETOUR_LABELS[v - 1]}
      </Text>
    </View>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/app/components/detour-style.ts apps/app/components/detour-style.test.ts apps/app/components/detour.tsx
git commit -m "feat: add native Detour rating component"
```

---

### Task 9: `EmptyState` component

**Files:**
- Create: `apps/app/components/empty-state.tsx`

- [ ] **Step 1: Write the component**

A simple centered-message box, matching `SignInPrompt`'s layout but with no sign-in buttons — reused across all three empty feed tabs.

```tsx
import { View } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { Body } from "./primitives";

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.paper }}>
      <Body style={{ textAlign: "center", color: colors.ink3, maxWidth: 260 }}>{message}</Body>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/components/empty-state.tsx
git commit -m "feat: add EmptyState component"
```

---

### Task 10: Feed data hooks

**Files:**
- Create: `apps/app/lib/feed/use-following-feed.ts`
- Create: `apps/app/lib/feed/use-nearby-feed.ts`
- Create: `apps/app/lib/feed/use-guides-feed.ts`

Framework glue (fetch-on-mount/param-change), same category as `useNearbyMapData`/`useUserLocation` — not unit tested, per this codebase's established split between tested pure logic and untested RN/effect glue. `supabase` is required lazily so importing these modules doesn't pull in `react-native` (mirrors `nearby-map-data.ts`).

- [ ] **Step 1: `use-following-feed.ts`**

```ts
import { useEffect, useState } from "react";
import {
  getFollowedUserIds, getFollowingFeedLogs, getFollowingFeedLists,
  getProfilesByIds, getCitiesByIds, getLogLikes, getCommentCountsByLog,
} from "@coffeesnob/supabase";
import { mergeFeedItems } from "./merge-feed-items";
import type { FeedItem, LogFeedCard, GuideFeedCard, CollectionFeedCard } from "./types";

export function useFollowingFeed(userId: string | null) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    async function load() {
      const { supabase } = require("../supabase");
      const followeeIds = await getFollowedUserIds(supabase, userId as string);
      const [logs, lists] = await Promise.all([
        getFollowingFeedLogs(supabase, followeeIds),
        getFollowingFeedLists(supabase, followeeIds),
      ]);

      const logIds = logs.map((l) => l.id);
      const curatorIds = lists.map((l) => l.curator_id).filter((id): id is string => id !== null);
      const cityIds = lists.map((l) => l.city_id).filter((id): id is string => id !== null);
      const actorIds = [...new Set([...logs.map((l) => l.user_id), ...curatorIds])];

      const [profiles, cities, likes, commentRows] = await Promise.all([
        getProfilesByIds(supabase, actorIds),
        getCitiesByIds(supabase, [...new Set(cityIds)]),
        getLogLikes(supabase, logIds),
        getCommentCountsByLog(supabase, logIds),
      ]);
      const nameById = new Map(profiles.map((p) => [p.id, p.display_name || p.username]));
      const cityNameById = new Map(cities.map((c) => [c.id, c.name]));

      const logCards: LogFeedCard[] = logs.map((l) => ({
        type: "log",
        id: l.id,
        createdAt: l.created_at,
        userId: l.user_id,
        authorName: nameById.get(l.user_id) ?? "Someone",
        shopName: (l.shops as { name: string } | null)?.name ?? "A shop",
        shopNeighborhood: (l.shops as { neighborhood: string | null } | null)?.neighborhood ?? null,
        rating: l.rating,
        note: l.note,
        likeCount: likes.filter((like) => like.log_id === l.id).length,
        likedByMe: likes.some((like) => like.log_id === l.id && like.user_id === userId),
        commentCount: commentRows.filter((c) => c.log_id === l.id).length,
      }));

      const listCards: (GuideFeedCard | CollectionFeedCard)[] = lists.map((l) => {
        const shopCount = (l.list_items as unknown as { count: number }[])[0]?.count ?? 0;
        if (l.type === "city_guide") {
          return {
            type: "guide", id: l.id, createdAt: l.created_at, title: l.title, description: l.description,
            cityName: l.city_id ? (cityNameById.get(l.city_id) ?? null) : null, shopCount,
          };
        }
        return {
          type: "collection", id: l.id, createdAt: l.created_at, title: l.title, description: l.description,
          curatorName: l.curator_id ? (nameById.get(l.curator_id) ?? "The desk") : "The desk", shopCount,
        };
      });

      if (!cancelled) {
        setItems(mergeFeedItems([logCards, listCards]));
        setLoading(false);
      }
    }

    load().catch(() => {
      if (!cancelled) {
        setItems([]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { items, loading };
}
```

- [ ] **Step 2: `use-nearby-feed.ts`**

```ts
import { useEffect, useState } from "react";
import { getShopsInBounds, getLogsForShops, getProfilesByIds, getLogLikes, getCommentCountsByLog } from "@coffeesnob/supabase";
import type { MapBounds } from "../../components/map/types";
import type { FeedItem, LogFeedCard } from "./types";

export function useNearbyFeed(bounds: MapBounds | null, userId: string | null) {
  const [items, setItems] = useState<LogFeedCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bounds) return;
    let cancelled = false;
    setLoading(true);

    async function load() {
      const { supabase } = require("../supabase");
      const shops = await getShopsInBounds(supabase, bounds as MapBounds);
      const shopIds = shops.map((s) => s.id);
      const logs = await getLogsForShops(supabase, shopIds);
      const logIds = logs.map((l) => l.id);

      const [profiles, likes, commentRows] = await Promise.all([
        getProfilesByIds(supabase, [...new Set(logs.map((l) => l.user_id))]),
        getLogLikes(supabase, logIds),
        getCommentCountsByLog(supabase, logIds),
      ]);
      const nameById = new Map(profiles.map((p) => [p.id, p.display_name || p.username]));
      const shopById = new Map(shops.map((s) => [s.id, s]));

      const cards: LogFeedCard[] = logs.map((l) => ({
        type: "log",
        id: l.id,
        createdAt: l.created_at,
        userId: l.user_id,
        authorName: nameById.get(l.user_id) ?? "Someone",
        shopName: shopById.get(l.shop_id)?.name ?? "A shop",
        shopNeighborhood: shopById.get(l.shop_id)?.neighborhood ?? null,
        rating: l.rating,
        note: l.note,
        likeCount: likes.filter((like) => like.log_id === l.id).length,
        likedByMe: likes.some((like) => like.log_id === l.id && like.user_id === userId),
        commentCount: commentRows.filter((c) => c.log_id === l.id).length,
      }));

      if (!cancelled) {
        setItems(cards.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
        setLoading(false);
      }
    }

    load().catch(() => {
      if (!cancelled) {
        setItems([]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [bounds, userId]);

  const feedItems: FeedItem[] = items;
  return { items: feedItems, loading };
}
```

- [ ] **Step 3: `use-guides-feed.ts`**

```ts
import { useEffect, useState } from "react";
import { getLiveCityGuides } from "@coffeesnob/supabase";
import type { FeedItem, GuideFeedCard } from "./types";

export function useGuidesFeed() {
  const [items, setItems] = useState<GuideFeedCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const { supabase } = require("../supabase");
    getLiveCityGuides(supabase)
      .then((guides) => {
        if (cancelled) return;
        const cards: GuideFeedCard[] = guides.map((g) => ({
          type: "guide",
          id: g.id,
          createdAt: g.created_at,
          title: g.title,
          description: g.description,
          cityName: g.cityName,
          shopCount: (g.list_items as unknown as { count: number }[])[0]?.count ?? 0,
        }));
        setItems(cards);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const feedItems: FeedItem[] = items;
  return { items: feedItems, loading };
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter app typecheck`
Expected: no errors. (If `list_items`/`shops` embed fields don't typecheck as plain objects against the generated `Database` type, cast the embed field with `as unknown as {...}` at the access site the same way `getCitiesWithShopCounts`'s caller does — already done above for `list_items`; apply the same pattern to any `shops` access that fails.)

- [ ] **Step 5: Commit**

```bash
git add apps/app/lib/feed/use-following-feed.ts apps/app/lib/feed/use-nearby-feed.ts apps/app/lib/feed/use-guides-feed.ts
git commit -m "feat: add Following/Nearby/Guides feed data hooks"
```

---

### Task 11: `CommentThread` component

**Files:**
- Create: `apps/app/components/feed/comment-thread.tsx`

Lazy-loads on first expand. Posting/replying awaits the server response (which returns the created row) and appends it directly — no optimistic placeholder needed since the round trip gives a real id/timestamp immediately. Liking is optimistic with rollback, since it's a single boolean flip.

- [ ] **Step 1: Write the component**

```tsx
import { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { getComments, getCommentLikes, getProfilesByIds, postComment, setCommentLike } from "@coffeesnob/supabase";
import { Avatar, BodySm, Label } from "../primitives";
import { buildCommentTree, type CommentWithMeta } from "../../lib/feed/comment-tree";

export function CommentThread({ logId, userId }: { logId: string; userId: string }) {
  const [comments, setComments] = useState<CommentWithMeta[] | null>(null);
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logId]);

  async function load(isCancelled: () => boolean) {
    const { supabase } = require("../../lib/supabase");
    const rows = await getComments(supabase, logId);
    const commentIds = rows.map((r) => r.id);
    const [profiles, likes] = await Promise.all([
      getProfilesByIds(supabase, [...new Set(rows.map((r) => r.user_id))]),
      getCommentLikes(supabase, commentIds),
    ]);
    const nameById = new Map(profiles.map((p) => [p.id, p.display_name || p.username]));
    if (isCancelled()) return;
    setComments(
      rows.map((r) => ({
        id: r.id,
        parentCommentId: r.parent_comment_id,
        userId: r.user_id,
        body: r.body,
        createdAt: r.created_at,
        authorName: nameById.get(r.user_id) ?? "Someone",
        likeCount: likes.filter((l) => l.comment_id === r.id).length,
        likedByMe: likes.some((l) => l.comment_id === r.id && l.user_id === userId),
      }))
    );
  }

  async function toggleLike(comment: CommentWithMeta) {
    const nextLiked = !comment.likedByMe;
    setComments((prev) =>
      (prev ?? []).map((c) => (c.id === comment.id ? { ...c, likedByMe: nextLiked, likeCount: c.likeCount + (nextLiked ? 1 : -1) } : c))
    );
    try {
      const { supabase } = require("../../lib/supabase");
      await setCommentLike(supabase, comment.id, userId, nextLiked);
    } catch {
      setComments((prev) =>
        (prev ?? []).map((c) => (c.id === comment.id ? { ...c, likedByMe: comment.likedByMe, likeCount: comment.likeCount } : c))
      );
    }
  }

  async function submit(parentCommentId: string | null) {
    const body = draft.trim();
    if (!body) return;
    const { supabase } = require("../../lib/supabase");
    const row = await postComment(supabase, { logId, userId, body, parentCommentId: parentCommentId ?? undefined });
    setComments((prev) => [
      ...(prev ?? []),
      { id: row.id, parentCommentId: row.parent_comment_id, userId: row.user_id, body: row.body, createdAt: row.created_at, authorName: "You", likeCount: 0, likedByMe: false },
    ]);
    setDraft("");
    setReplyingTo(null);
  }

  if (comments === null) {
    return (
      <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.rule2, alignItems: "center" }}>
        <ActivityIndicator color={colors.ink3} />
      </View>
    );
  }

  const tree = buildCommentTree(comments);

  return (
    <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.rule2, gap: 12 }}>
      {tree.map((c) => (
        <View key={c.id} style={{ gap: 10 }}>
          <CommentRow comment={c} indent={0} onLike={() => toggleLike(c)} onReply={() => setReplyingTo(replyingTo === c.id ? null : c.id)} />
          {c.replies.map((r) => (
            <CommentRow key={r.id} comment={r} indent={31} onLike={() => toggleLike(r)} />
          ))}
          {replyingTo === c.id && (
            <ComposeRow value={draft} onChange={setDraft} onSubmit={() => submit(c.id)} indent={31} placeholder={`Reply to ${c.authorName.split(" ")[0]}…`} />
          )}
        </View>
      ))}
      {replyingTo === null && <ComposeRow value={draft} onChange={setDraft} onSubmit={() => submit(null)} indent={0} placeholder="Add a comment…" />}
    </View>
  );
}

function CommentRow({ comment, indent, onLike, onReply }: { comment: CommentWithMeta; indent: number; onLike: () => void; onReply?: () => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 9, alignItems: "flex-start", marginLeft: indent }}>
      <Avatar name={comment.authorName} size={indent ? 19 : 22} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Label style={{ color: colors.ink }}>{comment.authorName}</Label>
        </View>
        <BodySm style={{ marginTop: 4 }}>{comment.body}</BodySm>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 7 }}>
          <Pressable onPress={onLike} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ color: comment.likedByMe ? colors.burnt : colors.ink3, fontSize: 12 }}>♥</Text>
            <Label style={{ color: comment.likedByMe ? colors.burnt : colors.ink3 }}>{String(comment.likeCount)}</Label>
          </Pressable>
          {onReply && (
            <Pressable onPress={onReply}>
              <Label style={{ color: colors.ink3 }}>Reply</Label>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function ComposeRow({ value, onChange, onSubmit, indent, placeholder }: { value: string; onChange: (v: string) => void; onSubmit: () => void; indent: number; placeholder: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 9, alignItems: "center", marginLeft: indent }}>
      <Avatar name="You" size={indent ? 19 : 22} />
      <View style={{ flex: 1, height: indent ? 30 : 34, borderWidth: 1, borderColor: colors.rule, borderRadius: 17, paddingHorizontal: 12, justifyContent: "center" }}>
        <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.ink3} onSubmitEditing={onSubmit} style={{ fontSize: 12, color: colors.ink }} />
      </View>
      <Pressable onPress={onSubmit}>
        <Label style={{ color: value.trim() ? colors.tealDk : colors.ink3 }}>Post</Label>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter app typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/app/components/feed/comment-thread.tsx
git commit -m "feat: add inline CommentThread component"
```

---

### Task 12: `LogCard`, `GuideCard`, `CollectionCard`

**Files:**
- Create: `apps/app/components/feed/log-card.tsx`
- Create: `apps/app/components/feed/guide-card.tsx`
- Create: `apps/app/components/feed/collection-card.tsx`

- [ ] **Step 1: `log-card.tsx`**

The like heart is optimistic with rollback, same pattern as the comment likes in Task 11.

```tsx
import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { setLogLike } from "@coffeesnob/supabase";
import { Avatar, Body, Label, D2 } from "../primitives";
import { Detour } from "../detour";
import { CommentThread } from "./comment-thread";
import type { LogFeedCard } from "../../lib/feed/types";

export function LogCard({ item, userId }: { item: LogFeedCard; userId: string }) {
  const [liked, setLiked] = useState(item.likedByMe);
  const [likeCount, setLikeCount] = useState(item.likeCount);
  const [commentsOpen, setCommentsOpen] = useState(false);

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      const { supabase } = require("../../lib/supabase");
      await setLogLike(supabase, item.id, userId, next);
    } catch {
      setLiked(!next);
      setLikeCount((c) => c - (next ? 1 : -1));
    }
  }

  return (
    <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.rule2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <Avatar name={item.authorName} size={26} />
        <Label style={{ color: colors.ink3 }}>Logged by</Label>
        <Label style={{ color: colors.ink }}>{item.authorName}</Label>
      </View>

      <D2>{item.shopName}</D2>
      {item.shopNeighborhood && <Label style={{ color: colors.ink3, marginTop: 6 }}>{item.shopNeighborhood}</Label>}
      <View style={{ marginTop: 11 }}>
        <Detour value={item.rating} />
      </View>
      {item.note && <Body style={{ marginTop: 10 }}>{item.note}</Body>}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginTop: 14 }}>
        <Pressable onPress={toggleLike} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Text style={{ color: liked ? colors.burnt : colors.ink2 }}>♥</Text>
          <Label style={{ color: colors.ink2 }}>{String(likeCount)}</Label>
        </Pressable>
        <Pressable onPress={() => setCommentsOpen((o) => !o)} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Text style={{ color: commentsOpen ? colors.ink : colors.ink2 }}>💬</Text>
          <Label style={{ color: colors.ink2 }}>{String(item.commentCount)}</Label>
        </Pressable>
        <Text style={{ color: colors.ink3 }}>🔖 Save</Text>
      </View>

      {commentsOpen && <CommentThread logId={item.id} userId={userId} />}
    </View>
  );
}
```

- [ ] **Step 2: `guide-card.tsx`**

```tsx
import { View } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { Body, D1, Label } from "../primitives";
import type { GuideFeedCard } from "../../lib/feed/types";

export function GuideCard({ item }: { item: GuideFeedCard }) {
  return (
    <View style={{ backgroundColor: colors.sage, padding: 20 }}>
      <Label style={{ color: colors.oxblood }}>{item.cityName ? `City guide · ${item.cityName}` : "City guide"}</Label>
      <D1 style={{ color: colors.oxblood, marginTop: 10, fontSize: 30, lineHeight: 30 }}>{item.title}</D1>
      {item.description && <Body style={{ color: colors.oxblood, marginTop: 10 }}>{item.description}</Body>}
      <Label style={{ color: colors.oxblood, marginTop: 16 }}>{item.shopCount} stops · Read the guide</Label>
    </View>
  );
}
```

- [ ] **Step 3: `collection-card.tsx`**

```tsx
import { View } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { Avatar, D4, Label } from "../primitives";
import type { CollectionFeedCard } from "../../lib/feed/types";

export function CollectionCard({ item }: { item: CollectionFeedCard }) {
  return (
    <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.rule2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <Avatar name={item.curatorName} size={26} />
        <Label style={{ color: colors.ink3 }}>Collected by</Label>
        <Label style={{ color: colors.ink }}>{item.curatorName}</Label>
      </View>
      <View style={{ borderWidth: 1, borderColor: colors.rule, borderRadius: 2, padding: 14, backgroundColor: colors.card }}>
        <Label style={{ color: colors.oxblood }}>A collection · {item.shopCount} shops</Label>
        <D4 style={{ marginTop: 7 }}>{item.title}</D4>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter app typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/app/components/feed/log-card.tsx apps/app/components/feed/guide-card.tsx apps/app/components/feed/collection-card.tsx
git commit -m "feat: add LogCard, GuideCard, CollectionCard"
```

---

### Task 13: Wire up the Home screen

**Files:**
- Modify: `apps/app/app/(tabs)/index.tsx`

- [ ] **Step 1: Replace the stub**

```tsx
import { useState, useEffect } from "react";
import { View, FlatList, Pressable, ActivityIndicator } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { useAuth } from "@/context/auth";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { EmptyState } from "@/components/empty-state";
import { Label } from "@/components/primitives";
import { LogCard } from "@/components/feed/log-card";
import { GuideCard } from "@/components/feed/guide-card";
import { CollectionCard } from "@/components/feed/collection-card";
import { useFollowingFeed } from "@/lib/feed/use-following-feed";
import { useNearbyFeed } from "@/lib/feed/use-nearby-feed";
import { useGuidesFeed } from "@/lib/feed/use-guides-feed";
import { useUserLocation } from "@/lib/map/use-user-location";
import { boundsAround } from "@/lib/map/bounds";
import type { FeedItem } from "@/lib/feed/types";

const TABS = ["Following", "Nearby", "Guides"] as const;
type Tab = (typeof TABS)[number];

const EMPTY_MESSAGE: Record<Tab, string> = {
  Following: "Nobody you follow has logged a visit yet.",
  Nearby: "Nothing logged nearby yet.",
  Guides: "No live guides yet.",
};

function renderItem(item: FeedItem, userId: string) {
  if (item.type === "log") return <LogCard item={item} userId={userId} />;
  if (item.type === "guide") return <GuideCard item={item} />;
  return <CollectionCard item={item} />;
}

export default function HomeScreen() {
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>("Following");
  const { center, loading: locationLoading } = useUserLocation();
  const [bounds, setBounds] = useState<ReturnType<typeof boundsAround> | null>(null);

  useEffect(() => {
    if (!locationLoading && center && !bounds) setBounds(boundsAround(center, 0.03));
  }, [locationLoading, center, bounds]);

  const following = useFollowingFeed(session?.user.id ?? null);
  const nearby = useNearbyFeed(bounds, session?.user.id ?? null);
  const guides = useGuidesFeed();

  if (!session) return <SignInPrompt message="Sign in to see what's near you." />;

  const active = tab === "Following" ? following : tab === "Nearby" ? nearby : guides;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={{ flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.rule }}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, paddingVertical: 11, alignItems: "center", backgroundColor: tab === t ? colors.ink : "transparent" }}>
            <Label style={{ color: tab === t ? colors.paper : colors.ink3 }}>{t}</Label>
          </Pressable>
        ))}
      </View>

      {active.loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.oxblood} />
        </View>
      ) : active.items.length === 0 ? (
        <EmptyState message={EMPTY_MESSAGE[tab]} />
      ) : (
        <FlatList data={active.items} keyExtractor={(item) => `${item.type}-${item.id}`} renderItem={({ item }) => renderItem(item, session.user.id)} />
      )}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter app typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/\(tabs\)/index.tsx
git commit -m "feat: wire up the Home feed screen"
```

---

### Task 14: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: all PASS across `packages/supabase` and `apps/app`.

- [ ] **Step 2: Run the full typecheck**

Run: `pnpm --filter @coffeesnob/supabase typecheck && pnpm --filter app typecheck`
Expected: no errors.

- [ ] **Step 3: Run the app and exercise all three tabs**

Run: `cd apps/app && pnpm start` (or the project's usual dev-server invocation), open on web or a simulator, sign in, and check:
- Following/Nearby/Guides all render their empty state (the dev database has 0 rows in `logs`/`lists`/`follows` — confirmed in the spec).
- To see real content, use the existing map screen to log a visit to a nearby shop first (via `log_shop_visit`), then confirm it shows up in the Nearby tab, and follow yourself... actually follow a second test account and confirm the Following tab shows that account's logged visit.
- Tap the comment icon on a log card — the thread expands, post a comment, reply to it, like both the comment and the reply, and confirm counts update.

- [ ] **Step 4: Final commit if anything was adjusted during manual verification**

```bash
git add -A
git commit -m "fix: address issues found in manual verification"
```
(Skip this step if nothing needed changing.)
