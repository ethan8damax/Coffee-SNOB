# V1 Soft Launch: Map Experience & Profile — Phases

Date: 2026-09-21 · Launch target: Tue 2026-09-29 (National Coffee Day)

## Scope reset (decided 2026-09-21)

V1 is a **web shop finder + review rater**. No cities, no city guides, no
curated write-ups, no photos (text-only logs), no DMs. Native app is later.
Mapbox is removed entirely; **Leaflet** is the only map.

Design source of truth: Claude Design project "Coffee Snob"
(`019df027-97af-74d2-a376-2a823fc1ddc5`) — `screens/map.jsx`, `shop.jsx`,
`log.jsx`, `profile.jsx`, `wide.jsx` (1440 desktop), `wide-tablet.jsx` (834).
Breakpoints to build: **phone (~393), tablet (~834), desktop (~1440)**.

## Design → v1 cut list

| Screen | Cut from design |
|---|---|
| Map | City pill/picker, "Live now / Opening next", "No Snob picks here", "Notify me when live", "Open now" + "Quiet" chips |
| Shop page | Editorial note (guide quote), Menu tab, Claim page, photos, member-edited hours/amenities |
| Log | Add to collection, Photograph, Who-can-see (v1 = public) |
| Profile | Message button, city count, photo grid (cards render without photos) |
| Nav | Guides (rail), Lists tab (until Phase U4), Home "Guides" sub-tab |

## Basemap decision

Free raster tiles + warm CSS tint, isolated in one file (`basemap.ts`) so a
custom Protomaps style can replace it later without touching anything else.
All brand-critical UI (pins, cards, sheet, chips) is our own DOM, matching
the design exactly. **Before launch: confirm the chosen provider's terms
allow commercial use, and keep the required attribution visible.**

## Decisions still open (defaults in bold — proceed with these unless told otherwise)

- **D1 Rated-pin threshold at launch: 1 log** (so the first logged shop
  earns a pin; otherwise the map is all dots on day one).
- **D2 Log fields v1: verdict + drink + note.** Character tags later. Adds a
  nullable `drink` column to `logs`.
- **D3 Saved shops in v1 (small `shop_saves` table); Collections after
  launch** (schema already exists, UI deferred).
- **D4 Admin dashboard after launch.** With no curated shops there is
  nothing to manage on day one; moderation = Supabase dashboard + a report
  button that writes to a `reports` table.

## Track 1 — Map experience

**M0 · Foundation (Mon 9/21)**
- Remove Mapbox: `@rnmapbox/maps`, `mapbox-gl`, `react-map-gl`, token env var, `app.json` plugin, stale docs mentions.
- Remove city/guide UI paths from map and Home (Guides sub-tab, GuideCard use).
- Design-system primitives audited against the design: TabBar (cream, custom icons, not default blue), buttons (`btn-ox/line/bu`), chips, Detour chevrons, eyebrow/label type (Forevs + Area Extended).
- Responsive shell: <1024px bottom tab bar; ≥1024px oxblood left rail (212px) + top bar with search + "Log a visit".
- Nav for v1: Home · Map · Log · You.

**M1 · Map core (Tue 9/22)**
- `react-leaflet` `MapView.web.tsx`; `MapView.native.tsx` = "web only for now" placeholder.
- `basemap.ts` (tile URL, tint filter, attribution).
- Pin layers: muted dots (unrated, OSM) under chevron tags (rated; tier 5 oxblood, 4 burnt, 1–3 outlined); selected states; user-location dot.
- Pan/zoom reloads data via existing `useNearbyMapData`; dot count capped/clustered so a dense area stays fast.
- Locate-me control.

**M2 · Map chrome, list, preview, responsive (Wed 9/23)**
- Mobile: top bar (locate, filter), chips (All / Rated / 4+), bottom sheet "shops near here" (rated first) with Map/List toggle.
- Tablet/desktop: 380px left list panel + full map canvas + zoom controls (per `wide.jsx` `WideMap`).
- Pin preview card: rated → arrow to shop page; unrated → "Not yet rated" + Log a visit + Directions.
- States: loading, location denied (fallback center + banner), Overpass error/timeout, no shops in view, offline.

**M3 · Shop page (Thu 9/24)**
- Route `/shop/[id]` (rated/logged shops only; unrated shops stay in the map preview until first log creates the row — matches design).
- Hero (oxblood block, no photo), consensus (most common verdict + average + log count), Log a visit / Save / Share.
- Tabs: Reviews · Hours · About (address, directions, website, phone from OSM data stored on the shop row).
- Desktop two-column layout per `WideShop`.

**M4 · Log flow (Fri 9/25)**
- Log screen per `log.jsx`: shop header, 5 verdict chips with sub-copy, drink chips, note, Publish.
- Entry points: map preview, shop page, rail/tab "Log". Uses existing `log_shop_visit` RPC for OSM shops.
- Migration: `logs.drink` (nullable); rated-pin threshold set to 1; after publish the pin updates.
- Empty/validation/failed-submit states; requires sign-in (existing SignInPrompt).

## Track 2 — User

**U1 · Profile core + follow (Sat 9/26)**
- Own profile and `/u/[username]`: avatar, name, stats (Entries, Followers, Following), entries list/grid with chevron ratings, Follow/Unfollow, settings + sign out.
- Migration: `profiles.bio` (nullable) + edit-profile screen (name, bio).

**U2 · Snob status + history + faves (Sun 9/27)**
- Snob status derived from log counts (no new tables): tier ladder defined in spec at build time; shown where the design's "year in coffee" block sits.
- Visit history heatmap from `visited_at`; "Faves" = own 4–5 verdict logs; Saved shops tab (`shop_saves`, D3).
- Followers/Following lists; find people by username.

**Q · QA + launch prep (Mon 9/28)**
- Side-by-side compare against the design at 393 / 834 / 1440 in Chrome; fix diffs.
- Keyboard + screen-reader pass on map, sheet, forms.
- Enable leaked-password protection; review `log_shop_visit` grant; confirm tile provider terms; Resend keys; deploy app + site; signup → log → profile smoke test on a phone.

**Launch (Tue 9/29)**

## Cut line if time slips (drop from the bottom)

1. Saved shops / Faves (U2)
2. Snob status polish (keep a simple tier badge)
3. Tablet-specific layouts (phone + desktop only)
4. Follow lists (keep follow button + counts)

Not droppable: M0–M4, U1, Q.

## After launch

Admin dashboard (mockup already exists in the design project; trim cities/
guides), reports queue, collections UI, merch, blog editor, site editor,
native app, notifications/mentions.
