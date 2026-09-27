# Map search lives in the list

Date: 2026-09-27. Status: approved in conversation, building.

## Problem

The map panel had two competing lists: the "nearby" list, and a search
dropdown drawn over it with its own ranking and row style. Search mixed
cities, rated shops and fuzzy worldwide junk ("wuz here" → Wu'an, Hebei).
"Best in <city>" promised curation but opened a page of every rated shop.

## Design

### One list

- Resting: the search bar says "Search a city or a shop"; the panel shows
  the nearby list (unchanged).
- Typing (2+ chars) replaces the panel list in place with two sections. No
  dropdown.
  - **Places** — up to 3 cities/neighborhoods, only on a real match. Tapping
    the row flies the map there, clears the query, and the list becomes that
    area (bar reads the place name, as today).
  - **Shops** — rated shops anywhere, unrated cafés anywhere. Same `ShopRow`
    as the nearby list. Ranked: best name match → rated first → nearest. Far
    shops carry their city as the secondary line.
- Filter chips apply to search results too ("Rated" / "Make the trip" hide
  unrated shops; places stay).
- Tapping a shop flies to it and opens its preview. The query stays; ✕
  clears it and brings back the nearby list.
- No matches: "No shops called “<q>” that we can find." plus the existing
  "Add a missing shop" action.
- Mobile: focusing search switches the sheet to List mode; tapping a shop
  switches to Map mode with its preview.

### Smarter matching

- **Strict match.** Every query word must start a word in the result's name,
  city or state. Kills fuzzy guesses. Applied server-side so the CDN caches
  clean results.
- **Name + place.** "muchacho atlanta": for 2+ word queries the server also
  asks Photon whether the last 1–2 words are a city. If so it returns
  `scoped: { name: "muchacho", place: Atlanta }`, and the app searches the
  coffee index around that place for the name (catches coffee-serving
  restaurants Photon's café filter misses).
- **Rated search** matches each word against the shop's name *or* its city,
  so "muchacho atlanta" and plain "atlanta" find rated shops there.

### Guides

- A "guide" means the curated editorial city guide (`lists.type =
  'city_guide'` for a `live`/`demo` city) — never raw ratings.
- `cities.city_key` (new, unique) joins a Photon place to its city row, using
  the same `cityKey()` rule as `shops.city_key`. Backfilled for the 9 seeded
  cities.
- `/api/search` returns `guideSlug` per place (null unless a real guide
  exists), replacing the verdict-based `cityKey` link.
- Search place rows with a guide get a **Guide** button (44pt target) that
  opens `<web>/city-guides/<slug>`. After flying to that place, the list
  header repeats "Read the <city> guide →".
- The app's rated-shops city page (`app/(tabs)/city/[slug].tsx`) is removed:
  the map list already shows what's rated in an area.

## Structure

- `apps/web/lib/photon.ts`: `matchesQuery(query, fields)`, `placeTails(query)`.
- `apps/web/app/api/search/route.ts`: strict filter, scoped lookup,
  `guideSlug`.
- `packages/supabase`: `citiesWithGuides(keys) → Map<key, slug>`;
  `searchRatedShops` matches name or locality. `citiesWithVerdicts` /
  `getCityShops` removed if unused.
- `apps/app/lib/map/search-sort.ts`: `buildSearchSections(results, filter)`.
- `apps/app/lib/map/use-map-search.ts`: debounced fetch hook (moved out of
  `MapSearch`).
- `MapSearch` becomes the input only; `map.tsx` owns the query and renders
  sections in the panel/sheet.

## Out of scope

- Filter build-out (next brainstorm).
- In-app guide screen (links to the web guide for now).
- Admin UI for `cities.city_key` on new cities (set in SQL for now).

## Testing

Unit: `matchesQuery`, `placeTails`, `buildSearchSections` (cap, filter,
dedupe). Manual: desktop web + mobile web, queries "wuz here", "george
howell boston", "muchacho atlanta", "tampa".
