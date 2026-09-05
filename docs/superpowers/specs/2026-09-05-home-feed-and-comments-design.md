# Coffee Snob — Home Feed & Comments Design

Date: 2026-09-05

## Context

First of the "9 product screens" sub-project (per
`2026-08-26-growth-strategy-design.md`'s build sequencing, step 4). The Home
tab (`apps/app/app/(tabs)/index.tsx`) is currently a literal stub. A mockup
already exists in the Claude Design project ("Coffee Snob", project id
`019df027-97af-74d2-a376-2a823fc1ddc5`) at `screens/home.jsx`: a three-tab
feed (Following / Nearby / Guides) mixing friend log entries, city-guide
promo cards, and collection cards, with like/comment/save affordances on log
entries.

This brainstorm also covered commenting on log entries — reply, react, and
tag people — which turned out to be big enough to split. **This spec covers
only Home feed + basic comments** (reply, like). Tagging/mentions and the
notification system (in-app Activity feed + push) are deliberately deferred
to a second sub-project, specced separately, because they pull in
substantially more infrastructure (autocomplete, push credentials, a new
screen, broader event coverage) than the feed itself needs.

Confirmed against the live Supabase project (`kyiuhuivyugoqljqodil`, "Coffee
SNOB"): the applied migrations match this repo's `supabase/migrations/`
exactly (0001–0013), no drift. `logs`, `lists`, and `follows` all have 0 rows
in production; `cities` has 9 seeded rows. This matters for the empty-state
requirement below — every tab will render its empty state on first ship.

## Decisions

### 1. Content scope: matches the mockup's mixed feed, minus photos

The mockup shows photos on log entries and engagement counts the schema
doesn't support yet. Resolved:
- **Photos**: not built. `logs` stays text-only per the existing
  growth-strategy decision (§5, "V1: text-only visit notes"). No photo
  placeholder rendered.
- **Likes and comments**: real, schema-backed (see §2), not decorative.

### 2. New schema: `comments` and `comment_likes`

```sql
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.logs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- Postgres CHECK constraints can't contain subqueries, so "a reply's parent
-- must itself be a top-level comment" (one level of nesting, no replies to
-- replies) is enforced with a trigger instead.
create or replace function public.enforce_one_level_comment_replies()
returns trigger language plpgsql as $$
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
```

- Comments attach to **log entries only** — not city guides or collections.
  That's what the mockup actually shows, and those content types don't have
  an obvious single "owner" the way a log entry does.
- One level of replies via a self-referencing `parent_comment_id`, enforced
  by a `before insert` trigger (a reply's parent must itself be a top-level
  comment) rather than at the application layer only.
- `comment_likes` mirrors the existing `list_saves` shape (composite PK, no
  surrogate id).
- RLS: publicly readable (matches `logs`/`list_saves`/`follows`); insert/
  delete restricted to the acting user, matching every other user-generated
  table in the schema.
- No mentions/tagging table — `body` is plain text. That's Sub-project B.

### 3. Feed composition, per tab

The mockup's "Following" tab mixes a log entry, a guide promo, and a
collection card — confirmed to keep that mixed-content approach rather than
splitting guides/collections out into "Guides" only.

- **Following**: union of (a) logs from users the current user follows, (b)
  lists (`type` either value) curated by followed users *or* editorial
  (`curator_id is null`), sorted by `created_at` descending. Implemented as
  two separate queries merge-sorted client-side — a SQL view isn't justified
  at this data volume (both tables are currently empty in production).
- **Nearby**: recent logs from *any* user, filtered by proximity to the
  device's current location. Reuses the geolocation hook/permission flow
  already built for the map screen (`2026-09-05-user-location-map-design.md`)
  rather than introducing a second location code path.
- **Guides**: `lists` where `type = 'city_guide'` and the city's `status =
  'live'`, most recent first. Collections are not shown here — they're
  covered by the Following tab's mixed feed and by the separate Lists tab
  (`apps/app/app/(tabs)/lists.tsx`, itself a stub and a future sub-project).

### 4. Card navigation: inert for this pass

Tapping a log, guide, or collection card does not navigate anywhere. Shop
detail, the guide reader, and collection detail are not yet built as routes
— each is its own future sub-project (shop detail was explicitly deferred
when this session picked Home over it). This matches how the map screen
shipped with some taps not going anywhere yet. Only the comment icon is
interactive on a log card.

### 5. Comments UI: inline, one level of replies, per-comment like

No comment-thread pattern existed anywhere in the design system before this
session — it's new UI, designed in Claude Design first per this project's
standing workflow. Final shape, ported into `screens/home.jsx`:

- Tapping the comment icon on a log card expands a thread inline below the
  engagement row (no new route, no modal) — pushes the rest of the card's
  content down.
- Each comment shows avatar, name, relative timestamp, body text, a heart
  (like toggle + count), and — for top-level comments only — a "Reply"
  label.
- Tapping "Reply" opens an indented compose row under that comment, prefixed
  with `@FirstName`, with a cancel (✕) affordance. Replies render indented
  (31px) under their parent, with a like heart but no "Reply" of their own —
  threading stops at one level, matching the schema's check constraint.
- The main compose row (new top-level comment) is hidden while a reply is in
  progress, to avoid two open text inputs at once.
- The comment icon's count reflects total comments + replies.

### 6. Empty states

Every tab ships against an empty database. Empty states reuse the existing
`SignInPrompt` component's simple centered-message pattern (`apps/app/
components/sign-in-prompt.tsx`) rather than new illustration work:
- Following, nobody followed yet or no activity: "Nobody you follow has
  logged a visit yet."
- Nearby, no nearby logs (or location permission not granted): "Nothing
  logged nearby yet" / a prompt to enable location if that's the blocker.
- Guides, no live city guides yet: "No live guides yet."

## Out of scope for this pass

- Tagging/mentions in comments, and the notification system (in-app Activity
  feed + Expo push) — Sub-project B, its own spec and plan.
- Photo upload on log entries.
- Shop detail, guide reader, and collection detail screens/routes.
- The Lists tab (collections) itself — remains a stub.
- A SQL view/materialized feed — client-side merge is enough at zero rows.
