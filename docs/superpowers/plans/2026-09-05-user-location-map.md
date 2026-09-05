# Center Map on User Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the map screen centered on the visitor's real device location instead of the hardcoded Lisbon default, falling back to Lisbon when location is denied, unavailable, or slow.

**Architecture:** A new `useUserLocation` hook resolves the device's coordinates via `expo-location` (raced against a timeout), a new `boundsAround` pure helper turns a center point into a viewport box, and both feed into `apps/app/app/(tabs)/map.tsx`, which shows a brief loading state until location settles and then renders the map already centered correctly. `MapView.native.tsx`/`MapView.web.tsx` stop hardcoding Lisbon and instead read an `initialCenter` prop.

**Tech Stack:** `expo-location`, Expo Router, React Native, Vitest.

---

### Task 1: Install `expo-location` and its config plugin

**Files:**
- Modify: `apps/app/package.json`
- Modify: `apps/app/app.json`

- [ ] **Step 1: Install the package**

```bash
cd apps/app
npx expo install expo-location
```

(`expo install` resolves the version compatible with this project's installed Expo SDK — do not hand-pin a version number.)

- [ ] **Step 2: Register the config plugin**

**Before editing, check the installed package's own docs for the current config plugin option names** — `apps/app/node_modules/expo-location/README.md` (or `apps/app/node_modules/expo-location/plugin/README.md` if the main README just links to it), specifically the iOS "when in use" permission string option. This session has already found two cases (`@rnmapbox/maps`'s download token, `react-map-gl`'s root export) where a plausible-looking snippet didn't match the actually-installed package — verify rather than assume.

As a starting point, add to the `"plugins"` array in `apps/app/app.json` (after the existing `"@rnmapbox/maps"` entry):

```json
[
  "expo-location",
  {
    "locationWhenInUsePermission": "Coffee Snob uses your location to show cafés nearby."
  }
]
```

Adjust the key name to match whatever the installed version's docs actually specify if it differs.

- [ ] **Step 3: Verify the app still boots**

Run: `pnpm --filter app typecheck`
Expected: PASS

Run: `cd apps/app && npx expo start --web` and confirm the app loads without a config-plugin error in the terminal. Stop it afterward (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add apps/app/package.json apps/app/app.json pnpm-lock.yaml
git commit -m "feat: install expo-location for centering the map on the user"
```

---

### Task 2: `boundsAround` pure helper

**Files:**
- Create: `apps/app/lib/map/bounds.ts`
- Test: `apps/app/lib/map/bounds.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/app/lib/map/bounds.test.ts
import { describe, it, expect } from "vitest";
import { boundsAround } from "./bounds";

describe("boundsAround", () => {
  it("builds a symmetric box around the center point", () => {
    expect(boundsAround({ lat: 38.71, lng: -9.14 }, 0.03)).toEqual({
      minLat: 38.68,
      maxLat: 38.74,
      minLng: -9.17,
      maxLng: -9.11,
    });
  });

  it("scales with a different span", () => {
    expect(boundsAround({ lat: 40, lng: -74 }, 0.1)).toEqual({
      minLat: 39.9,
      maxLat: 40.1,
      minLng: -74.1,
      maxLng: -73.9,
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter app test -- bounds`
Expected: FAIL — `./bounds` does not exist.

- [ ] **Step 3: Implement**

```typescript
// apps/app/lib/map/bounds.ts
import type { MapBounds } from "../../components/map/types";

// Rounds to 6 decimal places (~11cm of precision — far more than a map
// viewport needs) to avoid floating-point noise from plain +/- on decimal
// degrees: -9.14 + 0.03 is 9.110000000000001 without this, not -9.11.
function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function boundsAround(center: { lat: number; lng: number }, span: number): MapBounds {
  return {
    minLat: round(center.lat - span),
    maxLat: round(center.lat + span),
    minLng: round(center.lng - span),
    maxLng: round(center.lng + span),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter app test -- bounds`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/app/lib/map/bounds.ts apps/app/lib/map/bounds.test.ts
git commit -m "feat: add boundsAround helper for building a viewport box around a point"
```

---

### Task 3: `useUserLocation` hook

**Files:**
- Create: `apps/app/lib/map/use-user-location.ts`

No test file for this task: it's a thin wrapper around device/browser permission and sensor APIs, not practically unit-testable without new mocking infrastructure this codebase doesn't have — consistent with `useNearbyMapData` in `apps/app/lib/map/nearby-map-data.ts`, already untested for the same reason and marked with a `ponytail:` comment.

- [ ] **Step 1: Verify web support in the installed package**

Before writing this, check `apps/app/node_modules/expo-location/README.md` for its platform support table and any web-specific caveats for `requestForegroundPermissionsAsync` and `getCurrentPositionAsync`. Expo's hosted docs (as of this plan being written) list web as supported, polyfilling `navigator.geolocation` — but verify against what's actually installed.

**If web support looks solid:** implement Step 2 below as one cross-platform file, as written.

**If web support looks incomplete or you hit a real error running it under `expo start --web`:** split into `apps/app/lib/map/use-user-location.native.ts` (using `expo-location`, exactly as below) and `apps/app/lib/map/use-user-location.web.ts` (using the browser's `navigator.geolocation.getCurrentPosition`/`navigator.permissions` directly), matching the platform-extension pattern already used for `apps/app/components/map/MapView.native.tsx`/`MapView.web.tsx`. Both variants must export the same `useUserLocation` function with the same return shape described below. If you have to do this, note it clearly in your report — don't silently deviate from the plan's file list without saying so.

- [ ] **Step 2: Implement**

```typescript
// apps/app/lib/map/use-user-location.ts
import { useEffect, useState } from "react";
import * as Location from "expo-location";

const TIMEOUT_MS = 5000;

export type UserLocation = { center: { lat: number; lng: number } | null; loading: boolean };

export function useUserLocation(): UserLocation {
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
        const position = await Promise.race([Location.getCurrentPositionAsync().catch(() => null), timeout]);
        if (!position || cancelled) return;

        setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
      } catch {
        // Permission denied, hardware error, etc. — leave center null, caller falls back.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  return { center, loading };
}
```

`.catch(() => null)` on `getCurrentPositionAsync()` matters specifically because of the `Promise.race`: if the timeout wins first, that promise is still pending in the background, and an eventual unhandled rejection would otherwise surface as a console warning once it settles.

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter app typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/app/lib/map/use-user-location.ts
git commit -m "feat: add useUserLocation hook for resolving the device's location"
```

(If Step 1 required a `.native.ts`/`.web.ts` split, `git add` both files instead, and adjust the commit message to say so.)

---

### Task 4: Wire `initialCenter` through the map

**Files:**
- Modify: `apps/app/components/map/types.ts`
- Modify: `apps/app/components/map/MapView.native.tsx`
- Modify: `apps/app/components/map/MapView.web.tsx`
- Modify: `apps/app/app/(tabs)/map.tsx`

This is one task, not four, because `MapViewProps` gaining a new required field and its three call/definition sites must land together — splitting them would leave `pnpm --filter app typecheck` broken between commits.

- [ ] **Step 1: Add `initialCenter` to `MapViewProps`**

In `apps/app/components/map/types.ts`, find:

```typescript
export type MapViewProps = {
  ratedShops: RatedShopPin[];
  nearbyShops: NearbyShopPin[];
  onBoundsChange: (bounds: MapBounds) => void;
  selectedRatedShopId: string | null;
  selectedNearbyExternalId: string | null;
  onSelectRatedShop: (id: string | null) => void;
  onSelectNearbyShop: (externalId: string | null) => void;
};
```

Replace with:

```typescript
export type MapViewProps = {
  ratedShops: RatedShopPin[];
  nearbyShops: NearbyShopPin[];
  initialCenter: { lat: number; lng: number };
  onBoundsChange: (bounds: MapBounds) => void;
  selectedRatedShopId: string | null;
  selectedNearbyExternalId: string | null;
  onSelectRatedShop: (id: string | null) => void;
  onSelectNearbyShop: (externalId: string | null) => void;
};
```

- [ ] **Step 2: Use it in `MapView.native.tsx`**

In `apps/app/components/map/MapView.native.tsx`, find:

```typescript
export function MapView({
  ratedShops,
  nearbyShops,
  onBoundsChange,
  selectedRatedShopId,
  selectedNearbyExternalId,
  onSelectRatedShop,
  onSelectNearbyShop,
}: MapViewProps) {
```

Replace with:

```typescript
export function MapView({
  ratedShops,
  nearbyShops,
  initialCenter,
  onBoundsChange,
  selectedRatedShopId,
  selectedNearbyExternalId,
  onSelectRatedShop,
  onSelectNearbyShop,
}: MapViewProps) {
```

Then find:

```typescript
        <Camera defaultSettings={{ centerCoordinate: [-9.14, 38.71], zoomLevel: 13 }} />
```

Replace with:

```typescript
        <Camera defaultSettings={{ centerCoordinate: [initialCenter.lng, initialCenter.lat], zoomLevel: 13 }} />
```

- [ ] **Step 3: Use it in `MapView.web.tsx`**

In `apps/app/components/map/MapView.web.tsx`, find:

```typescript
export function MapView({
  ratedShops,
  nearbyShops,
  onBoundsChange,
  selectedRatedShopId,
  selectedNearbyExternalId,
  onSelectRatedShop,
  onSelectNearbyShop,
}: MapViewProps) {
```

Replace with:

```typescript
export function MapView({
  ratedShops,
  nearbyShops,
  initialCenter,
  onBoundsChange,
  selectedRatedShopId,
  selectedNearbyExternalId,
  onSelectRatedShop,
  onSelectNearbyShop,
}: MapViewProps) {
```

Then find:

```typescript
      initialViewState={{ longitude: -9.14, latitude: 38.71, zoom: 13 }}
```

Replace with:

```typescript
      initialViewState={{ longitude: initialCenter.lng, latitude: initialCenter.lat, zoom: 13 }}
```

- [ ] **Step 4: Wire it all together in `map.tsx`**

In `apps/app/app/(tabs)/map.tsx`, find:

```tsx
import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { MapView } from "../../components/map/MapView";
import { useNearbyMapData } from "../../lib/map/nearby-map-data";
import { openDirections } from "../../lib/directions";
import type { MapBounds } from "../../components/map/types";

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? "";

// Seed bounds so the first fetch fires on mount instead of waiting for
// onBoundsChange (onMoveEnd/onMapIdle don't fire for the initial camera
// settle — see map-screen bugfix notes). ±0.03° around the same Lisbon
// center (-9.14, 38.71) hardcoded as the initial viewport in both
// MapView.native.tsx and MapView.web.tsx — a rough zoom-13 city-level
// span; the first real pan corrects it via onBoundsChange.
const INITIAL_BOUNDS: MapBounds = { minLat: 38.68, minLng: -9.17, maxLat: 38.74, maxLng: -9.11 };

export default function MapScreen() {
  const [bounds, setBounds] = useState<MapBounds | null>(INITIAL_BOUNDS);
  const [selectedRatedShopId, setSelectedRatedShopId] = useState<string | null>(null);
  const [selectedNearbyExternalId, setSelectedNearbyExternalId] = useState<string | null>(null);
  const { ratedShops, nearbyShops } = useNearbyMapData(bounds, WEB_APP_URL);
```

Replace with:

```tsx
import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { MapView } from "../../components/map/MapView";
import { useNearbyMapData } from "../../lib/map/nearby-map-data";
import { useUserLocation } from "../../lib/map/use-user-location";
import { boundsAround } from "../../lib/map/bounds";
import { openDirections } from "../../lib/directions";
import type { MapBounds } from "../../components/map/types";

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? "";

// Used only when the visitor's real location can't be resolved (denied,
// unavailable, or timed out) — see useUserLocation.
const LISBON_FALLBACK = { lat: 38.71, lng: -9.14 };

export default function MapScreen() {
  const { center: userCenter, loading: locationLoading } = useUserLocation();
  const center = userCenter ?? LISBON_FALLBACK;
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [selectedRatedShopId, setSelectedRatedShopId] = useState<string | null>(null);
  const [selectedNearbyExternalId, setSelectedNearbyExternalId] = useState<string | null>(null);

  // Seed bounds once location settles, so the first data fetch fires
  // immediately instead of waiting for onBoundsChange (onMoveEnd/onMapIdle
  // don't fire for the initial camera settle — see map-screen bugfix
  // notes). Runs once: the `!bounds` check stops it from re-seeding after
  // a real pan has already set bounds to something else.
  useEffect(() => {
    if (!locationLoading && !bounds) setBounds(boundsAround(center, 0.03));
  }, [locationLoading, bounds, center]);

  const { ratedShops, nearbyShops } = useNearbyMapData(bounds, WEB_APP_URL);
```

All existing hooks (`useState` calls, `useNearbyMapData`) stay unconditional and in the same relative order — only the loading-state early return (added next) comes after all of them.

Next, find the closing of the `logNearbyVisit` function and the start of the `return` statement:

```tsx
  const logNearbyVisit = () => {
    if (!selectedNearbyShop) return;
    router.push({
      pathname: "/(tabs)/log",
      params: {
        externalId: selectedNearbyShop.externalId,
        name: selectedNearbyShop.name,
        lat: String(selectedNearbyShop.lat),
        lng: String(selectedNearbyShop.lng),
      },
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ratedShops={ratedShops}
        nearbyShops={nearbyShops}
        onBoundsChange={setBounds}
```

Replace with:

```tsx
  const logNearbyVisit = () => {
    if (!selectedNearbyShop) return;
    router.push({
      pathname: "/(tabs)/log",
      params: {
        externalId: selectedNearbyShop.externalId,
        name: selectedNearbyShop.name,
        lat: String(selectedNearbyShop.lat),
        lng: String(selectedNearbyShop.lng),
      },
    });
  };

  if (locationLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper }}>
        <ActivityIndicator color={colors.oxblood} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ratedShops={ratedShops}
        nearbyShops={nearbyShops}
        initialCenter={center}
        onBoundsChange={setBounds}
```

Nothing else in the file changes — the rest of the `return` block (both preview cards) stays exactly as it is.

- [ ] **Step 5: Verify typecheck and the full test suite**

Run: `pnpm --filter app typecheck && pnpm --filter app test`
Expected: both PASS.

- [ ] **Step 6: Manual verification**

Run both apps together:
```bash
pnpm --filter web dev &
cd apps/app && npx expo start --web
```
Open the map tab in a browser. Expected: a brief loading spinner, then a location permission prompt (browser-native), then the map opens centered on your actual location (or Lisbon if you deny the prompt) rather than always opening on Lisbon. Stop both processes afterward.

- [ ] **Step 7: Commit**

```bash
git add apps/app/components/map/types.ts apps/app/components/map/MapView.native.tsx apps/app/components/map/MapView.web.tsx "apps/app/app/(tabs)/map.tsx"
git commit -m "feat: center the map on the user's real location"
```

---

## Self-Review Notes

- **Spec coverage:** `expo-location` install + config plugin (Task 1), `boundsAround` extraction with real tests (Task 2), `useUserLocation` hook with the documented native/web-split contingency (Task 3), `initialCenter` threaded through both `MapView` platform files and `map.tsx`'s loading state (Task 4).
- **Not covered here (explicitly out of scope per the spec):** re-centering if the user's location changes while the map is open, any "location unavailable" error messaging, falling back to a nearest-launch-city center instead of Lisbon.
- **Floating-point note:** `boundsAround`'s rounding was verified numerically (not just assumed) against Node's actual arithmetic before writing this plan — `-9.14 + 0.03` really does produce `-9.110000000000001` without it.
