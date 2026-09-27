# User collections, Faves and Top 4

**Date:** 2026-09-27 · **Status:** approved design (owner, 2026-09-27)

People make their own collections of cafés (a Boston wishlist, a London
trip, all-time favourites), like Google Maps lists, and others can save the
public ones. The profile's tabs become **Entries · Collections · Faves**,
and the top of the profile becomes a hand-picked **Top 4**.

## Owner decisions

- A collection holds **any café on the map**, rated or not.
- **Each collection is public or private**; new ones start private. Private
  collections never appear on the profile, the feed or to savers.
- **Faves** = saved shops + saved collections (what Saved was). The owner
  chooses whether Faves shows on their profile; **off by default**.
- The old Faves grid (4 and 5 verdicts) goes away: Entries already has them.
- **Top 4**, Letterboxd-style: four slots, empty ones show a "+" on your own
  profile. Never filled automatically.

## Data (one migration)

Reuses what exists: `lists` (type `collection` already), `list_items`,
`list_saves` (+ `save_count` trigger), `shop_saves`, and the feed's
collection cards.

- `lists`: add `is_public boolean not null default false`. City guides are
  set public in the migration. `curator_id` is the owner.
  - Read: `type = 'city_guide' or is_public or curator_id = auth.uid()`
    (replaces "publicly readable"). Admin policies stay.
  - Insert / update / delete: the owner, only for `type = 'collection'`,
    active accounts only (same restrictive policy as saves).
  - Slug: generated server-side (title slug + short random suffix) so users
    never deal with it.
- `list_items`: read follows the parent list's read rule; the list owner
  inserts, updates (position, note) and deletes. Cap 200 items per list.
- `list_saves`: read = your own, or the saver's Faves are public and the
  list is readable. Saving a private list you can't read is impossible
  (insert checks the list is readable).
- `shop_saves`: read = your own, or the saver's Faves are public.
- `profiles.faves_public boolean not null default false`.
- New `profile_top_shops` (`user_id`, `slot` 1–4, `shop_id`), primary key
  (`user_id`, `slot`), unique (`user_id`, `shop_id`). Public read, owner
  writes. Slots are fixed positions: filling slot 3 leaves 1–2 empty.
- New RPC `ensure_shop(p_external_id, p_name, p_lat, p_lng, address,
  website, phone, hours, locality, region, country_code) returns uuid`: the
  shop-upsert half of `log_shop_visit` (same chain check, same legacy-id
  lookup done client-side first), without a log. An unrated shop never
  enters `shop_ratings`, so it can't show as rated anywhere.

## App

### Adding to a collection
- **"Add to collection"** on the shop page (next to Save) and on the map's
  preview card (unrated dots have no shop page).
- Opens a sheet: your collections with a check on the ones holding this
  café (tap to add/remove), and **New collection** (name + public toggle,
  then the café is added to it). Unrated cafés go through `ensure_shop`
  first.

### Collection page `/collection/[id]`
- Title, owner (links to profile), description, public/private label for
  the owner, save count.
- Shops in order: name, area, the owner's note; tapping opens the shop page
  (or, for an unrated café, the map at that spot).
- Visitors: **Save** (adds to their Faves).
- Owner: **Edit**: rename, description, public/private, remove shops, edit
  a shop's note, delete the collection. Order is add order (no drag
  reordering for now).

### Profile
- Tabs: **Entries · Collections · Faves**.
  - **Collections:** the person's collections (visitors see public ones
    only). Own profile: **New collection** first.
  - **Faves:** saved collections, then saved shops. Visitors see it only if
    the owner made it public; otherwise the tab isn't shown to them. Own
    profile: a line saying who can see it, with the switch in Settings.
- **Top 4** replaces the "Top shops" row. Own profile: empty slots show
  "+"; tapping one opens a picker of shops you've logged, with search.
  Tapping a filled slot: Replace or Remove. Visitors: only filled slots;
  the row is hidden when none are filled.
- Settings: **Show my Faves on my profile** switch.

### Feed
Collection cards already exist; they now open the collection page. Private
collections never reach the feed (RLS hides them).

## Out of scope

Drag reordering, collaborative collections, cover photos, collections on
the marketing site, sharing links outside the app.

## Done when

- PGlite tests for the RLS rules: private collection hidden from others and
  from the feed query; only the owner edits; Faves visible only when public;
  a private list can't be saved; Top 4 slot and uniqueness rules;
  `ensure_shop` refuses chains and never creates a log.
- Query unit tests; app helper tests (slot layout, Faves sections).
- Migration applied, advisors clean for new objects.
- Screens checked on the web build at phone and desktop widths.
