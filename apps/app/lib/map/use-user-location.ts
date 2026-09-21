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

    // The whole flow (permission prompt included) must not block the UI: an
    // unanswered browser prompt used to leave callers on a spinner forever.
    // After TIMEOUT_MS we stop reporting "loading" so the caller can render
    // with its fallback; if a fix arrives later, `center` is still updated.
    const giveUp = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, TIMEOUT_MS);

    async function resolve() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const position = await Location.getCurrentPositionAsync().catch(() => null);
        if (!position || cancelled) return;

        setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
      } catch {
        // Permission denied, hardware error, etc. — leave center null, caller falls back.
      } finally {
        clearTimeout(giveUp);
        if (!cancelled) setLoading(false);
      }
    }

    resolve();
    return () => {
      cancelled = true;
      clearTimeout(giveUp);
    };
  }, []);

  return { center, loading };
}
