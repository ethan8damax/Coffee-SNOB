# Center the Map on the User's Location — Design

## Problem

`apps/app`'s map screen hardcodes Lisbon (`[-9.14, 38.71]`) as the initial
center on both platforms (`MapView.native.tsx`, `MapView.web.tsx`), and
`(tabs)/map.tsx` seeds its initial data-fetch bounds as a fixed box around
that same point. Every visitor sees Portugal first, regardless of where they
actually are.

## Design

### 1. `useUserLocation` hook

New file: `apps/app/lib/map/use-user-location.ts`. Calls `expo-location`'s
`requestForegroundPermissionsAsync()` then `getCurrentPositionAsync()`,
raced against a ~5s timeout. Returns `{ center: { lat: number; lng: number }
| null; loading: boolean }`.

`expo-location`'s own docs list web as a supported platform (it polyfills
`navigator.geolocation`), so this is designed as one cross-platform hook,
not a `.native.ts`/`.web.ts` split. **Verify this against the actually-
installed package before writing the implementation** — this session has
already found two cases (`@rnmapbox/maps`'s download token,
`react-map-gl`'s root export) where installed-package reality didn't match
what documentation or a plausible-looking snippet implied. If web support
turns out incomplete at implementation time, fall back to splitting this
hook into `.native.ts` (uses `expo-location`) and `.web.ts` (uses
`navigator.geolocation` directly) — the same platform-extension pattern
already used for `MapView`.

Permission denial, a rejected promise, and the timeout are all treated
identically: resolve `loading` to `false` and leave `center` as `null`, so
the caller falls back to the existing Lisbon default. No error state, no
retry UI — consistent with the map screen's existing decision not to build
error/loading states for other failure modes (the OSM proxy, rated-shops
query) beyond what's been explicitly asked for.

### 2. `boundsAround` pure helper

Extract the box-around-a-point math (currently inline as the `INITIAL_BOUNDS`
constant in `map.tsx`) into a small, unit-tested pure function, likely
co-located in `apps/app/lib/map/nearby-map-data.ts` (already the home of
`MapBounds`-adjacent pure functions) or a new small file — implementer's
call, guided by "one clear responsibility per file." Signature:

```typescript
function boundsAround(center: { lat: number; lng: number }, span: number): MapBounds
```

Reused for both the real resolved location and the Lisbon fallback, so
there's exactly one implementation of "turn a point into a viewport box,"
not two copies that could drift.

### 3. `MapView` components take `initialCenter`

`MapViewProps` (`apps/app/components/map/types.ts`) gains `initialCenter:
{ lat: number; lng: number }`. Both `MapView.native.tsx`'s `Camera
defaultSettings.centerCoordinate` and `MapView.web.tsx`'s
`initialViewState` read from this prop instead of a hardcoded literal. Zoom
level (13) stays a hardcoded constant in both files — it's not something
`(tabs)/map.tsx` has any reason to vary.

### 4. `(tabs)/map.tsx`

Calls `useUserLocation()`. While `loading`, renders a brief loading state
(a centered `Body` or a spinner, matching the codebase's existing minimal
stub-screen style) instead of `<MapView>` — no jarring re-center after the
map is already visible, per the earlier decision. Once resolved, computes
`center = userLocation.center ?? LISBON_FALLBACK` and `bounds =
boundsAround(center, 0.03)`, then renders `<MapView initialCenter={center}
.../>` and passes `bounds` into `useNearbyMapData` exactly as today.

### 5. `app.json` permission config

Add the `expo-location` config plugin. **Check the plugin's actual current
option names in the installed package's own docs/README before writing
this** (same discipline as the Mapbox config plugin task). Best current
guess, to be verified: a `locationWhenInUsePermission` string, since this
app only ever needs foreground, one-shot location, never background
tracking. Copy should be short and factual, matching `apps/web/PRODUCT.md`'s
voice rules (no oversell, specific over vague): something like "Coffee Snob
uses your location to show cafés nearby."

## Testing

- `boundsAround`: fully unit-testable pure function — gets real test
  coverage.
- `useUserLocation`: platform-API-dependent (permissions, device sensors),
  not practically unit-testable without new mocking infrastructure this
  codebase doesn't have. Consistent with `nearby-map-data.ts`'s own
  `useNearbyMapData` hook (already untested for the same reason, marked
  with a `ponytail:` comment) — no new test added, and no new test
  infrastructure introduced for this one hook.
- `MapView.native.tsx`/`MapView.web.tsx` changes: typecheck-verified only,
  consistent with how these files have been treated throughout this
  session (no test file, per the original map-screen plan).

## Explicitly out of scope

- **Re-centering if the user's location changes while the map is open**
  (e.g. they're moving). `initialCenter` is exactly that — initial. Live
  location tracking is a materially bigger feature (continuous permission,
  battery/battery-UI considerations) not implied by this request.
- **Any error or "location unavailable" messaging.** Silent fallback to
  Lisbon, matching the map's existing error-handling posture elsewhere.
- **Falling back to a nearest-launch-city center instead of Lisbon** when
  location fails. Lisbon remains the one hardcoded fallback; nothing in
  this request asks for smarter fallback selection, and the live OSM
  "nearby" pin layer already works from any location regardless of whether
  it's a priority launch city.
