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

// Grows a box by `fraction` of its own size on every side (0.5 → 2x wide/tall).
export function padBounds(b: MapBounds, fraction: number): MapBounds {
  const dLat = (b.maxLat - b.minLat) * fraction;
  const dLng = (b.maxLng - b.minLng) * fraction;
  return { minLat: round(b.minLat - dLat), maxLat: round(b.maxLat + dLat), minLng: round(b.minLng - dLng), maxLng: round(b.maxLng + dLng) };
}

export function containsBounds(outer: MapBounds, inner: MapBounds): boolean {
  return outer.minLat <= inner.minLat && outer.maxLat >= inner.maxLat && outer.minLng <= inner.minLng && outer.maxLng >= inner.maxLng;
}
