# V1 Launch Tracker

**Launch: Tue 2026-09-29 (National Coffee Day) — soft launch.**
Plan and reasoning: `docs/superpowers/specs/2026-09-21-v1-map-and-profile-phases-design.md`
Design source: Claude Design project "Coffee Snob" (`019df027-97af-74d2-a376-2a823fc1ddc5`).

**How this file works:** check boxes off as work lands (`- [x]`), add a dated
line to the Status log at the bottom, and move anything new to "Parked". Keep
it short — details live in the spec.

**Now:** M0–M2 done; migration 0015 applied; `app.coffeesnobproject.com` is now Git-connected (pushes to `main` auto-deploy). Shop page and public profile verified with real data; **log form and your own profile still need a signed-in check** (needs you to sign in, or a test account). U2 built (Saved waits on migration 0016). Next: apply 0016, design-parity pass (log screen, profile), then QA.

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
- [x] Basemap: OpenFreeMap vector tiles recolored to the design palette via `brandStyle()`, one swap point (`basemap.ts`). CARTO's free tiles now need an API key ("API KEY REQUIRED" watermark), so they were dropped. maplibre-gl is pinned to v5 (v6 needs module workers Metro can't bundle).

## Track 1 — Map experience

### M0 · Foundation (Mon 9/21)
- [x] Remove city/guide UI from Home feed (city bits on the map itself go with the Leaflet swap in M1/M2)
- [x] Primitives vs design: oxblood TabBar, ButtonBu, Chip
- [x] ~~Forevs display typeface~~ — dropped 9/21: headlines stay Area (design's Forevs headlines are not being used)
- [x] Responsive shell: bottom tabs <1024px, oxblood left rail ≥1024px (top bar/search skipped — no search in v1)
- [x] v1 nav: Feed · Map · Log (+) · You

### M1 · Map core (Tue 9/22)
- [x] Remove Mapbox packages, `app.json` plugin (swapped atomically with Leaflet)
- [x] `react-leaflet` `MapView.web.tsx`; native placeholder
- [x] `basemap.ts` + `brand-style.ts` (style URL, palette, attribution)
- [x] Dot layer (unrated) + chevron-tag layer (rated) + selected states (verified visually with injected sample pins; no rated shops exist yet)
- [x] User-location dot + locate-me control (interim button top-right; M2 moves it into the top bar)
- [x] Pan/zoom reload via `useNearbyMapData`; dots capped at 400 (clustering later)
- [x] Map opens after 5s even if the browser location prompt is unanswered (was an infinite spinner)

### M2 · Chrome, list, preview, responsive (Wed 9/23)
- [x] Mobile top bar (area pill + locate), chips (All / Rated / Make the trip +), bottom sheet + Map/List toggle
- [x] Desktop 380px list panel + map canvas + zoom/locate stack
- [x] Pin preview cards (rated → shop page; unrated → Log a visit + Directions)
- [x] States: loading, location off (falls back to Atlanta), Overpass error + retry, empty, offline (error/offline paths by code, not forced in browser)

### M3 · Shop page (Thu 9/24)
- [x] `/shop/[id]` route + data query
- [x] Hero, consensus + Average, Log / Share (Save comes with U2), verified with real data
- [x] Tabs: Reviews · Hours · About
- [~] Desktop two-column layout

### M4 · Log flow (Fri 9/25)
- [x] Migration `0015` applied to production 9/21 (logs.drink, shop detail columns, profiles.bio, new `log_shop_visit`); verified grants and a rolled-back smoke test. Rated-pin threshold was already 1 log.
- [~] Log screen: verdict chips, drink, note, Publish
- [~] Entry points wired (map preview, shop page, nav)
- [~] Works for rated shops and OSM shops (`log_shop_visit`); pin updates after publish
- [~] Validation / failed-submit / signed-out states

## Track 2 — User

### U1 · Profile core + follow (Sat 9/26)
- [x] `profiles.bio` (migration 0015, applied)
- [~] `/u/[username]` verified with real data (stats, entries tiles); own `/profile` needs a signed-in check
- [~] Follow / unfollow
- [~] Edit profile (name, bio), sign out

### U2 · Status, history, faves (Sun 9/27)
- [x] Snob status tiers derived from log counts (Beginner 0 · Regular 5 · Connoisseur 15 · Snob 30 · Head Snob 60), verified on a real profile
- [x] Visit heatmap (last 12 weeks from `visited_at`), verified on a real profile
- [~] Faves tab (own/their 4–5 verdicts): empty state verified; not yet with a real 4–5 log
- [~] Saved shops: migration `0016_shop_saves.sql` applied 9/21 (RLS on, own-rows policy). Save button + Saved tab built; not yet exercised with a real save.
- [x] Followers / Following lists + Find people by username (`/people`), verified search against real profiles
- [ ] Design-parity pass on status block, heatmap, tabs, people screen (couldn't navigate the design canvas in the small test window)

## Q · QA + launch prep (Mon 9/28)

- [ ] Compare each screen to the design at 393 / 834 / 1440 in Chrome; fix diffs
- [ ] Keyboard + screen-reader pass (map, sheet, forms)
- [x] Supabase Auth → URL Configuration: Site URL `https://app.coffeesnobproject.com` + redirect URL `https://app.coffeesnobproject.com/**` set by you 9/21 (verify links were going to localhost). Still to confirm with a fresh sign-up.
- [ ] **LAUNCH BLOCKER — Supabase email sending:** sign-ups use Supabase's built-in mailer, capped at a handful of emails per hour project-wide (`429 over_email_send_rate_limit`, hit 9/21 by testers). Set up custom SMTP (Resend: `smtp.resend.com`, port 465, user `resend`, password = API key, verified sending domain) in Supabase → Auth → SMTP Settings, then raise Auth → Rate Limits → emails/hour. **Needs you** (domain verification + API key; same Resend account as the site's waitlist keys).
- [ ] Supabase: enable leaked-password protection
- [ ] Supabase: review `log_shop_visit` execute grant
- [ ] Confirm tile provider commercial terms + attribution visible
- [ ] Resend keys set (`RESEND_API_KEY`, `RESEND_AUDIENCE_ID`) — **needs you**
- [ ] Deploy app + site
- [ ] Phone smoke test: sign up → log a visit → see it on profile and map
- [ ] Launch Tue 9/29

**Legend:** `[x]` done and verified · `[~]` built and merged, NOT yet verified end-to-end (needs a real-data run and a browser/design check).

## Known issues / follow-ups (found 9/21)

- Shop, log and profile screens were built by parallel agents that could not read the Claude Design files — they match the brief, not necessarily the design. Needs a parity pass (shop page, log verdict chips + sub-copy, profile tiles).
- ~~PRODUCT.md vs mockup on numeric average~~ — decided 9/21: the mockup wins. The shop page shows "Average" beside the consensus word; PRODUCT.md carries the exception.
- Overpass (nearby cafés) takes ~12s cold, then cached 10 min; occasional 502 on larger areas. Consider a mirror/retry or bigger cache before launch.
- Map fallback area is now Atlanta (was Lisbon). The Home feed's Nearby tab still uses the Lisbon fallback.
- Vercel: the app project was CLI-only until 9/21 (no Git link); now connected. Production still has an unused `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` env var to remove.
- ~~Basemap slow first paint~~ — **not a real issue (9/21).** OpenFreeMap answers in ~45ms; the delay only happened in the automated test tab, which is `visibilityState: hidden`, so the browser pauses animation frames and MapLibre only draws when a screenshot forces a repaint. Confirm once on a real phone during the Q smoke test.
- Desktop (≥1024px) map layout was verified in a scaled iframe because the test browser window can't be resized past phone width.
- `log_shop_visit` previously let repeat logs rename a shop; fixed in 0015.

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
- 2026-09-21 — M0 built on `worktree-v1-m0-foundation`: oxblood tab bar (phones) + rail (desktop ≥1024px), ButtonBu, Chip, guides removed from feed. 102 tests pass, web build OK. Forevs dropped (headlines stay Area).
- 2026-09-21 — M1 done: Leaflet + OpenFreeMap map (recolored to the design palette), design pins, locate-me; Mapbox removed. Parallel agents built the data layer (migration 0015 + queries), shop page + log screen, and profile UI; all merged to local `main`, 200 tests green. Navbar spacing fixed. Migration not applied; nothing pushed since M0.
- 2026-09-21 — Migration 0015 applied to production and smoke-tested (rolled back). Mockup is source of truth for the shop page's Average. `main` pushed to GitHub (M0, M1, data layer, shop/log/profile UI).
- 2026-09-21 — M2 done and merged: map chrome (phone sheet/chips/top bar, desktop panel), preview cards, states. Verified shop page + public profile with a temporary test shop (removed; DB back to 0 shops/0 logs). Fixed follow-button height and clipped names. Vercel app project connected to GitHub.
- 2026-09-21 — Pushed M2; the newly Git-connected Vercel app project auto-deployed it to production (Ready in ~1 min). Live `/map` verified: real Kennesaw cafés, list, tab bar; basemap draws but slowly on first load.
