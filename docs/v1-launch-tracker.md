# V1 Launch Tracker

**Launch: Tue 2026-09-29 (National Coffee Day) — soft launch.**
Plan and reasoning: `docs/superpowers/specs/2026-09-21-v1-map-and-profile-phases-design.md`
Design source: Claude Design project "Coffee Snob" (`019df027-97af-74d2-a376-2a823fc1ddc5`).

**How this file works:** check boxes off as work lands (`- [x]`), add a dated
line to the Status log at the bottom, and move anything new to "Parked". Keep
it short — details live in the spec.

**Now:** M0 done except Forevs font (waiting on file). Next: M1 map core. Work is on branch `worktree-v1-m0-foundation` (worktree `.claude/worktrees/v1-m0-foundation`), not yet merged.

## Setup (done)

- [x] Repo cloned, `pnpm install` run
- [x] Env files written (`apps/web/.env.local`, `apps/app/.env.local`, gitignored) — Supabase URL + anon key set
- [x] Project audit: typecheck clean, 99 tests passing, DB state checked (9 cities, 0 shops/logs, 1 user)
- [x] Scope reset: web shop finder + review rater; no cities/guides/photos/DMs
- [x] Claude Design + live app reviewed
- [x] Phases written and dated

## Decisions

- [x] D1 Rated-pin threshold = 1 log at launch *(confirmed 9/21)*
- [x] D2 Log fields = verdict + drink + note *(confirmed 9/21)*
- [x] D3 Saved shops in v1, collections after *(confirmed 9/21)*
- [x] D4 Admin dashboard after launch *(confirmed 9/21)*
- [x] Leaflet only, Mapbox removed entirely
- [x] Basemap: free raster tiles + warm tint, one swap point (`basemap.ts`)

## Track 1 — Map experience

### M0 · Foundation (Mon 9/21)
- [x] Remove city/guide UI from Home feed (city bits on the map itself go with the Leaflet swap in M1/M2)
- [x] Primitives vs design: oxblood TabBar, ButtonBu, Chip
- [ ] Forevs display typeface for D1/D2 *(needs `Forevs-Bold.otf` from you)*
- [x] Responsive shell: bottom tabs <1024px, oxblood left rail ≥1024px (top bar/search skipped — no search in v1)
- [x] v1 nav: Feed · Map · Log (+) · You

### M1 · Map core (Tue 9/22)
- [ ] Remove Mapbox packages, token env var, `app.json` plugin, doc mentions (swapped atomically with Leaflet)
- [ ] `react-leaflet` `MapView.web.tsx`; native placeholder
- [ ] `basemap.ts` (tile URL, tint, attribution)
- [ ] Dot layer (unrated) + chevron-tag layer (rated) + selected states
- [ ] User-location dot + locate-me control
- [ ] Pan/zoom reload via `useNearbyMapData`; dense-area cap/clustering

### M2 · Chrome, list, preview, responsive (Wed 9/23)
- [ ] Mobile top bar, chips (All / Rated / 4+), bottom sheet + Map/List toggle
- [ ] Desktop 380px list panel + map canvas + zoom controls
- [ ] Pin preview cards (rated → shop page; unrated → Log a visit + Directions)
- [ ] States: loading, location denied, Overpass error, empty, offline

### M3 · Shop page (Thu 9/24)
- [ ] `/shop/[id]` route + data query
- [ ] Hero, consensus, Log / Save / Share
- [ ] Tabs: Reviews · Hours · About
- [ ] Desktop two-column layout

### M4 · Log flow (Fri 9/25)
- [ ] Migration: `logs.drink`; rated-pin threshold → 1
- [ ] Log screen: verdict chips, drink, note, Publish
- [ ] Entry points wired (map preview, shop page, nav)
- [ ] Works for rated shops and OSM shops (`log_shop_visit`); pin updates after publish
- [ ] Validation / failed-submit / signed-out states

## Track 2 — User

### U1 · Profile core + follow (Sat 9/26)
- [ ] Migration: `profiles.bio`
- [ ] Own profile + `/u/[username]`: avatar, name, stats, entries with chevrons
- [ ] Follow / unfollow
- [ ] Edit profile (name, bio), sign out

### U2 · Status, history, faves (Sun 9/27)
- [ ] Snob status tiers derived from log counts
- [ ] Visit heatmap from `visited_at`
- [ ] Faves (own 4–5 verdicts)
- [ ] Saved shops (`shop_saves` migration + UI)
- [ ] Followers / Following lists; find people by username

## Q · QA + launch prep (Mon 9/28)

- [ ] Compare each screen to the design at 393 / 834 / 1440 in Chrome; fix diffs
- [ ] Keyboard + screen-reader pass (map, sheet, forms)
- [ ] Supabase: enable leaked-password protection
- [ ] Supabase: review `log_shop_visit` execute grant
- [ ] Confirm tile provider commercial terms + attribution visible
- [ ] Resend keys set (`RESEND_API_KEY`, `RESEND_AUDIENCE_ID`) — **needs you**
- [ ] Deploy app + site
- [ ] Phone smoke test: sign up → log a visit → see it on profile and map
- [ ] Launch Tue 9/29

## Cut line (drop from the bottom if time slips)

1. Saved shops / Faves
2. Snob status polish (keep a simple tier badge)
3. Tablet-specific layouts (phone + desktop only)
4. Follow lists (keep follow button + counts)

Not droppable: M0–M4, U1, Q.

## Parked (after launch)

Admin dashboard (mockup exists; trim cities/guides), reports queue,
collections UI, merch store, blog editor, site editor, native app,
notifications/mentions, Parish-style HQ patterns.

## Status log

- 2026-09-21 — Setup done, scope reset, design reviewed, phases and tracker written. Next: M0 once D1–D4 are confirmed.
- 2026-09-21 — M0 built on `worktree-v1-m0-foundation`: oxblood tab bar (phones) + rail (desktop ≥1024px), ButtonBu, Chip, guides removed from feed. 102 tests pass, web build OK. Forevs display font pending `Forevs-Bold.otf`.
