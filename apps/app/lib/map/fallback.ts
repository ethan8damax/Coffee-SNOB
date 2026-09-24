type Point = { lat: number; lng: number };

// Where the map and the Home feed open when the visitor's real location
// isn't available (denied, unavailable, or not yet answered).
export const FALLBACK_CITY = { name: "Atlanta", lat: 33.749, lng: -84.388 };

// Per-viewer convenience only (web): open where they last were instead of the
// fallback. Storage can be missing (native), blocked, or cleared — every path
// degrades to null / no-op.
const KEY = "snob:last-location";

export function readLastLocation(): Point | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return typeof p?.lat === "number" && typeof p?.lng === "number" ? { lat: p.lat, lng: p.lng } : null;
  } catch {
    return null;
  }
}

export function saveLastLocation(p: Point): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ lat: p.lat, lng: p.lng }));
  } catch {
    // storage blocked — nothing to do
  }
}
