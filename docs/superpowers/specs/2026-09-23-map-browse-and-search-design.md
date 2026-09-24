# Map: browse and search, in three phases

**Date:** 2026-09-23 · **Launch:** Tue 2026-09-29 (soft launch)
**Why:** a critique of the map (see "Findings" below) turned up problems every
user hits on day one, plus a search that can't find a shop outside ~110 km
and has no notion of a city. The map is really two products — *what's around
me* (browse) and *find a place* (search) — and this spec treats them
separately.

## Findings this is built on (checked 2026-09-23)

1. Search waits for the slowest of four sources before showing anything; the
   OSM name search is ~12s cold and flaky.
2. Search fires one Nominatim reverse-geocode per shop result, in parallel —
   over Nominatim's 1 req/s policy, from shared Vercel IPs. Risk: blocked.
3. Unrated shops are only searchable within ~110 km of the map center, and
   rated-shop search is a whole-phrase `ilike` ("muchacho atlanta" misses).
4. Every rated shop shows twice (rated pin + OSM dot): `shop_ratings` doesn't
   expose `external_id`, so the app can't match them.
5. Map loads miss the cache almost always (per-instance memory, keyed on the
   exact box); zoomed-out boxes time out; no "zoom in" state.
6. No city data: all shops have `city_id = null`; cities are all coming_soon
   with 0 guides.
7. ~15% of OSM "cafés" aren't coffee (bubble tea, cafeterias, diners).
8. Small: list count is capped at 50 but labelled as the total; Home feed
   falls back to Lisbon (map uses Atlanta); up to 5s spinner before the map
   draws; `logs.user_id` unindexed; 10 RLS policies re-evaluate `auth.uid()`
   per row.

Photon (komoot's OSM geocoder) was tested live: cafés and places worldwide in
one ~0.7s call, with city/state per result and OSM IDs matching our
`external_id` format. It can filter by OSM key but not by cuisine.

## Phase 1 — launch fixes (by Mon 9/28)

Small changes that fix what everyone sees on day one. No new services.

- **One pin per shop.** Add `external_id` to the end of `shop_ratings`
  (`create or replace view` can append a column); carry it on `RatedShopPin`;
  drop OSM dots whose `externalId` matches a rated pin (list and map both).
- **Cacheable map fetches.** The client snaps its padded fetch box outward to
  a fixed 0.1° grid, so nearby viewers request identical URLs.
  `/api/nearby-shops` returns `Cache-Control: public, s-maxage=600,
  stale-while-revalidate=86400`, so Vercel's CDN serves repeats for every
  user, not per instance. The in-memory cache stays as a second layer.
- **Zoom limit.** If the fetch box spans more than ~0.35° (roughly a metro
  area), skip the OSM request, show rated pins only, and show a "Zoom in to
  see every café" state in the list/sheet instead of a spinner or error.
- **No Nominatim bursts.** Remove the per-result reverse-geocode from search.
  OSM results show street + `addr:city`/`addr:state` from their own tags
  (added to `toNearbyShop`); rated results show neighborhood or nothing.
  Phase 2 restores a proper "City, ST" line from Photon.
- **Coffee only.** In `/api/nearby-shops`, drop elements whose cuisine is
  bubble tea / tea with no `coffee_shop`, and names matching
  cafeteria / dining hall / food court. Pure function, unit tested with the
  real Atlanta cases (Kung Fu Tea, Piedmont North Dining Hall, …).
- **Honest count.** "N shops nearby" and the search-bar count use the
  filtered total, not the 50-row list cap.
- **Draw the map right away.** Open on the last known location
  (`localStorage`, per-viewer convenience) or the Atlanta fallback, and fly
  to the real location when the fix arrives — no 5s spinner.
- **One fallback city.** Home feed's Nearby tab uses the map's Atlanta
  fallback (shared constant).
- **Database hygiene** (one migration): index `logs(user_id)`; rewrite the 10
  flagged policies to `(select auth.uid())` — same rules, evaluated once per
  query.

**Done when:** a rated shop shows once; a second visitor to the same area gets
dots instantly (CDN hit, verified via response headers); zoomed-out view shows
the zoom-in state; a search makes no reverse-geocode calls; downtown Atlanta
shows no bubble tea or cafeterias; perf advisors no longer flag the 10
policies or `logs.user_id`.

## Phase 2 — search rebuild (week after launch)

Search answers "find a place", anywhere, fast.

- **`/api/search`** (apps/web): proxies Photon with `q`, a location bias
  (current map center), and `osm_tag=amenity:cafe` + `osm_tag=place`.
  Returns `{ kind: "place" | "shop", name, secondary: "City, ST, Country",
  lat, lng, externalId? }`, maps Photon's `N123`/`W123` to our
  `node/123`/`way/123`, applies the chain name filter, and sends the same
  CDN cache headers. Photon is fair-use; if volume grows, self-host it (it's
  one Docker image) — note, not a launch concern.
- **Staged results.** The search box shows sources as they land instead of
  waiting for all:
  1. Our database — rated shops, instant.
  2. `/api/search` — cafés and cities worldwide, ~1s.
  3. Only if stage 2 found fewer than 3 shops: the existing local OSM name
     search (catches coffee-serving restaurants/bars like Muchacho before
     anyone has rated them — Photon can't filter restaurants by cuisine).
  A quiet "Searching more cafés…" row shows while stages are pending.
- **Ranking.** Exact / prefix name matches first, then rated before unrated,
  then distance from the map center. Dedupe across stages by `externalId`.
- **Far-away picks work.** Choosing a shop outside the loaded area flies there
  and selects it even before the area's dots load (the result itself becomes
  the selected pin).
- **Rated-shop search by words.** Match every word of the query in any order
  instead of the whole phrase.

**Done when:** "muchacho" from Nashville finds the Atlanta Muchacho in ~1s;
"dancing goats" lists Atlanta + Decatur; rated matches appear before Photon
returns; picking a far shop opens its preview card.

## Phase 3 — city pages (once ratings exist)

"Best shops in a city" only has something to rank once people log, so this
comes after launch and is ranked on our data, not OSM.

- **Shops know their city.** When a shop is first logged, store
  `locality` (city), `region`, `country` on `shops`, from the Photon/OSM data
  the log already comes from. Backfill the existing shops once.
- **City page** (`/city/[slug]` in the app): rated shops in that city,
  ordered by verdict then log count, with each shop's consensus chip; below a
  small threshold of rated shops, an honest "Not enough verdicts yet — see
  every café on the map" state.
- **Search links to it.** A city result offers "Best in Atlanta" alongside
  "Show on map".
- **Faster rated pins.** Replace the bounds query on `shop_ratings` (which
  aggregates every shop before filtering) with an RPC that filters the box on
  `shops(lat, lng)` first, then aggregates.
- The `cities` table stays for editorial guides (parked); city pages key off
  `shops.locality`, not `city_id`.

**Done when:** logging a shop records its city; an Atlanta page lists rated
Atlanta shops best-first; a city with no ratings shows the empty state; the
rated-pins query plan filters on the index.

## Out of scope

Bulk-importing OSM data (keeps us clear of ODbL share-alike obligations for
our own database); clustering pins; hours/"open now"; contacts-based friend
finding; the native app's map.

## Testing

Pure functions get unit tests (dedupe, grid snap, zoom limit, coffee filter,
Photon ID mapping, ranking). Each phase is verified against live data the way
the chain filter was — real Atlanta/London boxes, before/after counts — and
migrations are checked in production (query results + security/performance
advisors) before code that needs them deploys.
