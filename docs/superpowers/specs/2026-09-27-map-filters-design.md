# Map filters: Effort + You

Date: 2026-09-27. Status: approved in conversation, building.

## Problem

The map had three chips (All / Rated / Make the trip +): quality only, and
nothing for the early user's real jobs: working through a backlog of shops to
rate, and keeping their own collection.

## Design

One row under search, two dropdown chips. They combine.

- **Effort ▾** (filters what's in view): Any · Rated · Worth the detour + (3+)
  · Make the trip + (4+) · Catch a flight (5) · Snob-Approved. Anything but
  Any hides unrated cafés.
- **You ▾** (signed in only): Any · Saved · Been · Not been.
  - **Saved** / **Been** show *everywhere*: the pins and list become your
    saved (or logged) shops, nearest first, and the map zooms to fit them.
  - **Not been** filters what's in view: drops rated shops you've logged
    (unrated cafés are unlogged by definition).
- The chip label shows the active choice ("Make the trip +") and fills when it
  isn't Any. Tapping opens a small menu; picking closes it.
- Filters apply to pins, list, and search results alike. In memory only.

### Empty states

- Saved, none: "Nothing saved yet. Tap Save on any shop page."
- Been, none: "No logs yet. Your first one starts your map."
- Filters exclude everything: "Nothing here fits. Try a wider Effort."

## Data

- `getMyShops(client, userId)` → `{ saved: string[]; been: string[]; shops }`:
  your saved and logged shop ids, and those shops as pins — rated ones from
  `shop_ratings`, never-rated saved ones from `shops` (shown as unrated rows,
  tap to log). Loaded when the map is focused and You isn't Any.

## Structure

- `lib/map/shop-list.ts`: `MapFilter = { effort, you }`, `EFFORT_OPTIONS`,
  `YOU_OPTIONS`, `applyFilter(filter, rated, nearby, mine)` pure.
- `lib/map/bounds.ts`: `fitPoints(points)` → center + zoom for the fly-to.
- `lib/map/use-my-shops.ts`: the fetch hook.
- `components/map/map-controls.tsx`: `FilterChips` → two `FilterMenu` chips.

## Out of scope

Open now (needs an hours parser), friends' picks, tags/price (no data yet),
remembering filters across reloads.

## Testing

Unit: every effort option, each You option, a combination, fitPoints.
Manual: desktop + phone widths.
