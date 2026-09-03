# Map Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `(tabs)/map.tsx` stub with a real Mapbox map rendering two pin layers — live "nearby" OpenStreetMap results (muted, unrated) and "rated" shops (Snob-Approved or community-logged, tiered by rating) — with tap-to-preview and a Directions action, per `docs/superpowers/specs/2026-09-03-map-community-shops-design.md` and the revised `screens/map.jsx` mockup in the "Coffee Snob" Claude Design project (`019df027-97af-74d2-a376-2a823fc1ddc5`).

**Architecture:** Per the prior `2026-08-26-map-and-admin-dashboard-design.md` spec, `MapView` is split into `MapView.native.tsx` (`@rnmapbox/maps`) and `MapView.web.tsx` (`react-map-gl`) behind Expo's platform-extension file resolution, sharing one props contract. A small hook fetches both pin layers (Supabase `shop_ratings` view + the OSM proxy from the data-layer plan) whenever the visible bounds settle. Depends on `2026-09-03-map-shop-data-layer.md` being implemented first (needs `shop_ratings`, `getRatedShopsInBounds`, and the `/api/nearby-shops` proxy to exist).

**Tech Stack:** `@rnmapbox/maps` (native), `mapbox-gl` + `react-map-gl` (web), Expo Router, Vitest.

**Prerequisite (not code — do this before Task 1):** A Mapbox account and public access token. Sign up at mapbox.com, create a token scoped for client-side use (Mapbox's own default scoping is safe for this), and add it to `apps/app/.env` (gitignored, not committed) as `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=<token>`, plus to Vercel's env config for `apps/web` if the token is ever needed there, and to EAS secrets for native builds (`eas secret:create --name EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN --value <token>`). This is an external account signup — not something that can be automated here.

**Out of scope (see spec + this session's design work):**
- The admin Candidates page (blocked on a Claude Design mockup).
- **Actually building the log-a-visit screen.** `(tabs)/log.tsx` is still a stub, but a full mockup already exists (`screens/log.jsx` in the Claude Design project) with a richer feature set (drink picker, character tags, collections, photo, visibility) than the current schema supports (`logs` only has `rating` + `note`). Turning that stub into a working screen — trimmed to what the schema actually backs — is real, separate work deserving its own plan; cramming a half-built version of a more detailed mockup into this plan would ship something inconsistent with its own design reference. This plan wires the map's "Log a visit" button to *navigate* to that tab with the target shop as params; until that follow-up plan is done, it lands on the stub.
- Mapbox Studio custom styling (uses the default `mapbox://styles/mapbox/light-v11` style for now).

---

### Task 1: Install Mapbox dependencies

**Files:**
- Modify: `apps/app/package.json`
- Modify: `apps/app/app.json`

- [ ] **Step 1: Install the native and web map packages**

Run:
```bash
cd apps/app
npx expo install @rnmapbox/maps
pnpm add mapbox-gl react-map-gl
pnpm add -D @types/mapbox-gl
```
(`expo install` resolves the version compatible with this project's installed Expo SDK — do not hand-pin a version number for `@rnmapbox/maps`.)

- [ ] **Step 2: Register the Expo config plugin**

`@rnmapbox/maps` needs a config plugin entry for native builds. **Before editing, check the config plugin's exact current shape in the installed package's own README** (`apps/app/node_modules/@rnmapbox/maps/README.md`, "Installation" / "Expo" section) — this API has changed across major versions and this repo's Expo/RN versions (Expo ~57, RN 0.86) are newer than what any pre-existing documentation you might recall covers (see `apps/app/AGENTS.md`: "Expo HAS CHANGED — read the exact versioned docs before writing any code").

As a starting point, add to the `"plugins"` array in `apps/app/app.json`:
```json
[
  "@rnmapbox/maps",
  {
    "RNMapboxMapsDownloadToken": "$EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN"
  }
]
```
Adjust the key names to match whatever the installed version's README actually specifies if it differs.

- [ ] **Step 3: Verify the app still boots**

Run: `pnpm --filter app typecheck`
Expected: PASS

Run: `cd apps/app && npx expo start --web` and confirm the app loads without a config-plugin error in the terminal. Stop it afterward (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add apps/app/package.json apps/app/app.json pnpm-lock.yaml
git commit -m "feat: install Mapbox dependencies for the map screen"
```

---

### Task 2: Shared map types

**Files:**
- Create: `apps/app/components/map/types.ts`

- [ ] **Step 1: Write the shared prop/data types**

```typescript
// apps/app/components/map/types.ts

export type MapBounds = { minLat: number; minLng: number; maxLat: number; maxLng: number };

// A shop worth a tiered pin — either Snob-Approved or past the community
// log threshold. See docs/superpowers/specs/2026-09-03-map-community-
// shops-design.md, "Map rendering / integration".
export type RatedShopPin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  neighborhood: string | null;
  isSnobApproved: boolean;
  tag: string | null;
  priceTier: string | null;
  rating: number;
  logCount: number;
};

// A live OpenStreetMap result — unrated, no shops row exists for it yet.
export type NearbyShopPin = {
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  hours: string | null;
  website: string | null;
  phone: string | null;
};

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

- [ ] **Step 2: Commit**

```bash
git add apps/app/components/map/types.ts
git commit -m "feat: add shared map pin/props types"
```

---

### Task 3: Pin style helper

**Files:**
- Create: `apps/app/components/map/pin-style.ts`
- Test: `apps/app/components/map/pin-style.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/app/components/map/pin-style.test.ts
import { describe, it, expect } from "vitest";
import { colors } from "@coffeesnob/design-tokens";
import { pinStyleForRating } from "./pin-style";

describe("pinStyleForRating", () => {
  it("uses oxblood for a 5", () => {
    expect(pinStyleForRating(5)).toEqual({ background: colors.oxblood, foreground: colors.cream, border: colors.oxblood });
  });

  it("uses burnt for a 4", () => {
    expect(pinStyleForRating(4)).toEqual({ background: colors.burnt, foreground: colors.ink, border: colors.burnt });
  });

  it("uses an outlined/muted style for 1-3", () => {
    expect(pinStyleForRating(3)).toEqual({ background: colors.card, foreground: colors.ink2, border: colors.rule });
    expect(pinStyleForRating(1)).toEqual({ background: colors.card, foreground: colors.ink2, border: colors.rule });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter app test -- pin-style`
Expected: FAIL — `./pin-style` does not exist.

- [ ] **Step 3: Implement**

```typescript
// apps/app/components/map/pin-style.ts
import { colors } from "@coffeesnob/design-tokens";

// Mirrors the Claude Design mockup's map screen (screens/map.jsx `tier()`):
// 5 -> oxblood, 4 -> burnt, 1-3 -> outlined/muted.
export type PinStyle = { background: string; foreground: string; border: string };

export function pinStyleForRating(rating: number): PinStyle {
  if (rating >= 5) return { background: colors.oxblood, foreground: colors.cream, border: colors.oxblood };
  if (rating === 4) return { background: colors.burnt, foreground: colors.ink, border: colors.burnt };
  return { background: colors.card, foreground: colors.ink2, border: colors.rule };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter app test -- pin-style`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/app/components/map/pin-style.ts apps/app/components/map/pin-style.test.ts
git commit -m "feat: add rating-tier pin styling"
```

---

### Task 4: Directions helper

**Files:**
- Create: `apps/app/lib/directions.ts`
- Test: `apps/app/lib/directions.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/app/lib/directions.test.ts
import { describe, it, expect } from "vitest";
import { directionsUrl } from "./directions";

describe("directionsUrl", () => {
  it("builds a universal Google Maps directions URL", () => {
    expect(directionsUrl(38.71, -9.14)).toBe("https://www.google.com/maps/dir/?api=1&destination=38.71,-9.14");
  });
});
```

(`openDirections` itself, which calls `Linking.openURL`, is a one-line wrapper around this — not separately unit tested here, since importing `react-native`'s `Linking` module into a Vitest test risks pulling in RN's Flow-typed internals that Vitest's default transform doesn't understand. The pure URL-building logic above is what actually has a branch-free-but-exact-format requirement worth pinning down.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter app test -- directions`
Expected: FAIL — `./directions` does not exist.

- [ ] **Step 3: Implement**

```typescript
// apps/app/lib/directions.ts
import { Linking } from "react-native";

// One universal URL, no per-platform branching (see docs/superpowers/specs/
// 2026-09-03-map-community-shops-design.md, "Map rendering / integration").
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function openDirections(lat: number, lng: number) {
  return Linking.openURL(directionsUrl(lat, lng));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter app test -- directions`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/app/lib/directions.ts apps/app/lib/directions.test.ts
git commit -m "feat: add directions URL helper"
```

---

### Task 5: Nearby map data fetching

**Files:**
- Create: `apps/app/lib/map/nearby-map-data.ts`
- Test: `apps/app/lib/map/nearby-map-data.test.ts`

- [ ] **Step 1: Write the failing tests for the pure pieces**

```typescript
// apps/app/lib/map/nearby-map-data.test.ts
import { describe, it, expect, vi } from "vitest";
import { fetchNearbyOsmShops, toRatedShopPin } from "./nearby-map-data";

describe("fetchNearbyOsmShops", () => {
  it("fetches from the given web app's proxy with the bounds as query params", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ shops: [{ externalId: "node/1", name: "Corner Cafe" }] }) })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const shops = await fetchNearbyOsmShops({ minLat: 1, minLng: 2, maxLat: 3, maxLng: 4 }, "https://example.com");

    expect(shops).toEqual([{ externalId: "node/1", name: "Corner Cafe" }]);
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/api/nearby-shops?minLat=1&minLng=2&maxLat=3&maxLng=4");
    vi.unstubAllGlobals();
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 502 })));
    await expect(fetchNearbyOsmShops({ minLat: 1, minLng: 2, maxLat: 3, maxLng: 4 }, "https://example.com")).rejects.toThrow(
      "nearby-shops request failed: 502"
    );
    vi.unstubAllGlobals();
  });
});

describe("toRatedShopPin", () => {
  it("maps a shop_ratings row to camelCase", () => {
    const pin = toRatedShopPin({
      id: "s1", name: "Noi Coffee", lat: 38.7, lng: -9.1, neighborhood: "Príncipe Real",
      is_snob_approved: true, tag: "Espresso bar", price_tier: "€€", rating: 5, log_count: 12,
    });
    expect(pin).toEqual({
      id: "s1", name: "Noi Coffee", lat: 38.7, lng: -9.1, neighborhood: "Príncipe Real",
      isSnobApproved: true, tag: "Espresso bar", priceTier: "€€", rating: 5, logCount: 12,
    });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter app test -- nearby-map-data`
Expected: FAIL — `./nearby-map-data` does not exist.

- [ ] **Step 3: Implement**

```typescript
// apps/app/lib/map/nearby-map-data.ts
import { useEffect, useRef, useState } from "react";
import { getRatedShopsInBounds } from "@coffeesnob/supabase";
import { supabase } from "../supabase";
import type { MapBounds, NearbyShopPin, RatedShopPin } from "../../components/map/types";

const DEBOUNCE_MS = 400;

export async function fetchNearbyOsmShops(bounds: MapBounds, webAppUrl: string): Promise<NearbyShopPin[]> {
  const params = new URLSearchParams({
    minLat: String(bounds.minLat),
    minLng: String(bounds.minLng),
    maxLat: String(bounds.maxLat),
    maxLng: String(bounds.maxLng),
  });
  const response = await fetch(`${webAppUrl}/api/nearby-shops?${params}`);
  if (!response.ok) throw new Error(`nearby-shops request failed: ${response.status}`);
  const { shops } = (await response.json()) as { shops: NearbyShopPin[] };
  return shops;
}

type RatedShopRow = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  neighborhood: string | null;
  is_snob_approved: boolean;
  tag: string | null;
  price_tier: string | null;
  rating: number | null;
  log_count: number;
};

export function toRatedShopPin(row: RatedShopRow): RatedShopPin {
  return {
    id: row.id,
    name: row.name,
    lat: row.lat!,
    lng: row.lng!,
    neighborhood: row.neighborhood,
    isSnobApproved: row.is_snob_approved,
    tag: row.tag,
    priceTier: row.price_tier,
    rating: row.rating!,
    logCount: row.log_count,
  };
}

// ponytail: debounce/fetch-on-bounds-change wiring only — the pure
// fetch/mapping functions above are what's unit tested; this hook is
// framework glue (useState/useEffect/setTimeout), not branching logic.
export function useNearbyMapData(bounds: MapBounds | null, webAppUrl: string) {
  const [ratedShops, setRatedShops] = useState<RatedShopPin[]>([]);
  const [nearbyShops, setNearbyShops] = useState<NearbyShopPin[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!bounds) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      getRatedShopsInBounds(supabase, bounds)
        .then((rows) => setRatedShops(rows.map(toRatedShopPin)))
        .catch(() => setRatedShops([]));
      fetchNearbyOsmShops(bounds, webAppUrl)
        .then(setNearbyShops)
        .catch(() => setNearbyShops([]));
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [bounds, webAppUrl]);

  return { ratedShops, nearbyShops };
}
```

- [ ] **Step 4: Run to verify the tests pass, then typecheck**

Run: `pnpm --filter app test -- nearby-map-data && pnpm --filter app typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/app/lib/map/nearby-map-data.ts apps/app/lib/map/nearby-map-data.test.ts
git commit -m "feat: add nearby map data fetching (OSM proxy + rated shops)"
```

---

### Task 6: `MapView.native.tsx`

**Files:**
- Create: `apps/app/components/map/MapView.native.tsx`

- [ ] **Step 1: Implement**

Before writing this, skim `apps/app/node_modules/@rnmapbox/maps/README.md` for the current `MapView`/`Camera`/`PointAnnotation` API and `getVisibleBounds()` return shape — confirm it still resolves to `[[neLng, neLat], [swLng, swLat]]` as used below, since this library's API has shifted across versions.

```tsx
// apps/app/components/map/MapView.native.tsx
import { useCallback, useRef } from "react";
import { View } from "react-native";
import Mapbox, { MapView as RNMapboxMapView, Camera, PointAnnotation } from "@rnmapbox/maps";
import { colors } from "@coffeesnob/design-tokens";
import { pinStyleForRating } from "./pin-style";
import type { MapViewProps } from "./types";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "");

export function MapView({
  ratedShops,
  nearbyShops,
  onBoundsChange,
  selectedRatedShopId,
  selectedNearbyExternalId,
  onSelectRatedShop,
  onSelectNearbyShop,
}: MapViewProps) {
  const mapRef = useRef<RNMapboxMapView>(null);

  const handleRegionDidChange = useCallback(async () => {
    const bounds = await mapRef.current?.getVisibleBounds();
    if (!bounds) return;
    const [[neLng, neLat], [swLng, swLat]] = bounds;
    onBoundsChange({ minLat: swLat, maxLat: neLat, minLng: swLng, maxLng: neLng });
  }, [onBoundsChange]);

  return (
    <View style={{ flex: 1 }}>
      <RNMapboxMapView ref={mapRef} style={{ flex: 1 }} styleURL="mapbox://styles/mapbox/light-v11" onRegionDidChange={handleRegionDidChange}>
        <Camera defaultSettings={{ centerCoordinate: [-9.14, 38.71], zoomLevel: 13 }} />

        {nearbyShops.map((shop) => {
          const selected = selectedNearbyExternalId === shop.externalId;
          return (
            <PointAnnotation key={shop.externalId} id={shop.externalId} coordinate={[shop.lng, shop.lat]} onSelected={() => onSelectNearbyShop(shop.externalId)}>
              <View
                style={{
                  width: selected ? 11 : 7,
                  height: selected ? 11 : 7,
                  borderRadius: 999,
                  backgroundColor: selected ? colors.ink : colors.card,
                  borderWidth: 1.4,
                  borderColor: selected ? colors.ink : colors.ink3,
                }}
              />
            </PointAnnotation>
          );
        })}

        {ratedShops.map((shop) => {
          const style = pinStyleForRating(shop.rating);
          const selected = selectedRatedShopId === shop.id;
          return (
            <PointAnnotation key={shop.id} id={shop.id} coordinate={[shop.lng, shop.lat]} onSelected={() => onSelectRatedShop(shop.id)}>
              <View
                style={{
                  paddingVertical: 5,
                  paddingHorizontal: 7,
                  borderRadius: 2,
                  backgroundColor: style.background,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? colors.ink : style.border,
                }}
              />
            </PointAnnotation>
          );
        })}
      </RNMapboxMapView>
    </View>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter app typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/app/components/map/MapView.native.tsx
git commit -m "feat: add native MapView with two pin layers"
```

---

### Task 7: `MapView.web.tsx`

**Files:**
- Create: `apps/app/components/map/MapView.web.tsx`

- [ ] **Step 1: Implement**

```tsx
// apps/app/components/map/MapView.web.tsx
import { useCallback, useRef } from "react";
import Map, { Marker, type MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { colors } from "@coffeesnob/design-tokens";
import { pinStyleForRating } from "./pin-style";
import type { MapViewProps } from "./types";

export function MapView({
  ratedShops,
  nearbyShops,
  onBoundsChange,
  selectedRatedShopId,
  selectedNearbyExternalId,
  onSelectRatedShop,
  onSelectNearbyShop,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null);

  const handleMoveEnd = useCallback(() => {
    const bounds = mapRef.current?.getBounds();
    if (!bounds) return;
    onBoundsChange({
      minLat: bounds.getSouth(),
      maxLat: bounds.getNorth(),
      minLng: bounds.getWest(),
      maxLng: bounds.getEast(),
    });
  }, [onBoundsChange]);

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? ""}
      initialViewState={{ longitude: -9.14, latitude: 38.71, zoom: 13 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/light-v11"
      onMoveEnd={handleMoveEnd}
    >
      {nearbyShops.map((shop) => {
        const selected = selectedNearbyExternalId === shop.externalId;
        return (
          <Marker key={shop.externalId} longitude={shop.lng} latitude={shop.lat} onClick={() => onSelectNearbyShop(shop.externalId)}>
            <div
              style={{
                width: selected ? 11 : 7,
                height: selected ? 11 : 7,
                borderRadius: "50%",
                background: selected ? colors.ink : colors.card,
                border: `1.4px solid ${selected ? colors.ink : colors.ink3}`,
                cursor: "pointer",
              }}
            />
          </Marker>
        );
      })}

      {ratedShops.map((shop) => {
        const style = pinStyleForRating(shop.rating);
        const selected = selectedRatedShopId === shop.id;
        return (
          <Marker key={shop.id} longitude={shop.lng} latitude={shop.lat} onClick={() => onSelectRatedShop(shop.id)}>
            <div
              style={{
                padding: "5px 7px",
                borderRadius: 2,
                background: style.background,
                border: `${selected ? 2 : 1}px solid ${selected ? colors.ink : style.border}`,
                cursor: "pointer",
              }}
            />
          </Marker>
        );
      })}
    </Map>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter app typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/app/components/map/MapView.web.tsx
git commit -m "feat: add web MapView with two pin layers"
```

---

### Task 8: Wire the map screen

**Files:**
- Modify: `apps/app/app/(tabs)/map.tsx`

- [ ] **Step 1: Implement the screen**

```tsx
// apps/app/app/(tabs)/map.tsx
import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { MapView } from "../../components/map/MapView";
import { useNearbyMapData } from "../../lib/map/nearby-map-data";
import { openDirections } from "../../lib/directions";
import type { MapBounds } from "../../components/map/types";

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? "";

export default function MapScreen() {
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [selectedRatedShopId, setSelectedRatedShopId] = useState<string | null>(null);
  const [selectedNearbyExternalId, setSelectedNearbyExternalId] = useState<string | null>(null);
  const { ratedShops, nearbyShops } = useNearbyMapData(bounds, WEB_APP_URL);

  const selectedRatedShop = ratedShops.find((s) => s.id === selectedRatedShopId) ?? null;
  const selectedNearbyShop = nearbyShops.find((s) => s.externalId === selectedNearbyExternalId) ?? null;

  const selectRated = (id: string | null) => {
    setSelectedRatedShopId(id);
    setSelectedNearbyExternalId(null);
  };
  const selectNearby = (externalId: string | null) => {
    setSelectedNearbyExternalId(externalId);
    setSelectedRatedShopId(null);
  };

  const logRatedVisit = () => {
    if (!selectedRatedShop) return;
    router.push({ pathname: "/(tabs)/log", params: { shopId: selectedRatedShop.id, name: selectedRatedShop.name } });
  };
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
        selectedRatedShopId={selectedRatedShopId}
        selectedNearbyExternalId={selectedNearbyExternalId}
        onSelectRatedShop={selectRated}
        onSelectNearbyShop={selectNearby}
      />

      {selectedRatedShop && (
        <View style={{ position: "absolute", left: 16, right: 16, bottom: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, borderRadius: 2, padding: 12 }}>
          <Text style={{ fontWeight: "700", color: colors.ink }}>{selectedRatedShop.name}</Text>
          <Text style={{ color: colors.ink3, marginTop: 4 }}>{selectedRatedShop.neighborhood} · {selectedRatedShop.tag}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <Pressable onPress={logRatedVisit} style={{ flex: 1, backgroundColor: colors.oxblood, padding: 10, borderRadius: 2, alignItems: "center" }}>
              <Text style={{ color: colors.cream, fontWeight: "700" }}>Log a visit</Text>
            </Pressable>
            <Pressable onPress={() => openDirections(selectedRatedShop.lat, selectedRatedShop.lng)} style={{ padding: 10, borderWidth: 1, borderColor: colors.ink3, borderRadius: 2 }}>
              <Text style={{ color: colors.ink }}>Directions</Text>
            </Pressable>
          </View>
        </View>
      )}

      {selectedNearbyShop && (
        <View style={{ position: "absolute", left: 16, right: 16, bottom: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.rule, borderRadius: 2, padding: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontWeight: "700", color: colors.ink }}>{selectedNearbyShop.name}</Text>
            <Text style={{ color: colors.ink3 }}>Not yet rated</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <Pressable onPress={logNearbyVisit} style={{ flex: 1, backgroundColor: colors.oxblood, padding: 10, borderRadius: 2, alignItems: "center" }}>
              <Text style={{ color: colors.cream, fontWeight: "700" }}>Log a visit</Text>
            </Pressable>
            <Pressable onPress={() => openDirections(selectedNearbyShop.lat, selectedNearbyShop.lng)} style={{ padding: 10, borderWidth: 1, borderColor: colors.ink3, borderRadius: 2 }}>
              <Text style={{ color: colors.ink }}>Directions</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Add `EXPO_PUBLIC_WEB_APP_URL` to the local env**

Add to `apps/app/.env` (gitignored, not committed) pointing at wherever `apps/web` runs locally:
```
EXPO_PUBLIC_WEB_APP_URL=http://localhost:3000
```
For production/EAS builds, this needs to point at the deployed `apps/web` URL instead — set it as an EAS secret the same way as the Mapbox token.

- [ ] **Step 3: Manual verification**

Run both apps together:
```bash
pnpm --filter web dev &
cd apps/app && npx expo start --web
```
Open the map tab. Expected: the map renders, panning/zooming shows muted dots (nearby OSM cafes) and any tiered pins (Lisbon's seeded shops, if you pan there), tapping a pin shows the matching preview card, "Directions" opens Google Maps in a new tab, "Log a visit" navigates to the (stub) log tab. Stop both processes afterward.

- [ ] **Step 4: Commit**

```bash
git add "apps/app/app/(tabs)/map.tsx"
git commit -m "feat: build the map screen with rated and nearby pin layers"
```

---

## Self-Review Notes

- **Spec coverage:** worldwide viewport-bound queries (Task 5-8), two-pin-layer rendering matching the revised mockup (Task 3, 6, 7), Directions button with the universal URL (Task 4), tap-to-log entry point (Task 8).
- **Not covered here (explicitly deferred, see "Out of scope" above):** the log-a-visit screen itself, the admin Candidates page, Mapbox Studio styling.
- **Type consistency check:** `RatedShopPin`/`NearbyShopPin`/`MapBounds`/`MapViewProps` (Task 2) are used identically in `nearby-map-data.ts` (Task 5), both `MapView.*.tsx` files (Task 6-7), and `map.tsx` (Task 8) — same field names throughout (`isSnobApproved`, `priceTier`, `logCount`, `externalId`, camelCased consistently).
