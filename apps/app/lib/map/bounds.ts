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
