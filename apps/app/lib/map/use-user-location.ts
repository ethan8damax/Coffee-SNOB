import { useEffect, useState } from "react";
import * as Location from "expo-location";

const TIMEOUT_MS = 5000;

export type UserLocation = { center: { lat: number; lng: number } | null; loading: boolean };

// ponytail: thin wrapper around device/browser permission + sensor APIs — not
// practically unit-testable without new mocking infrastructure, same as
// useNearbyMapData above. Verified expo-location's web shim (ExpoLocation.web.ts)
// implements requestForegroundPermissionsAsync/getCurrentPositionAsync for real via
// navigator.permissions/navigator.geolocation, so one cross-platform file is enough.
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
