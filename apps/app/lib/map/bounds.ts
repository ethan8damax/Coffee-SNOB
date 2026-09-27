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

export function withinBounds(b: MapBounds, lat: number, lng: number): boolean {
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

// Grows a box outward to a fixed grid (step in degrees). Viewers looking at
// roughly the same area then request byte-identical URLs, which the CDN caches
// for everyone (see /api/nearby-shops Cache-Control).
export function snapToGrid(b: MapBounds, step: number): MapBounds {
  const down = (n: number) => round(Math.floor(round(n / step)) * step);
  const up = (n: number) => round(Math.ceil(round(n / step)) * step);
  return { minLat: down(b.minLat), minLng: down(b.minLng), maxLat: up(b.maxLat), maxLng: up(b.maxLng) };
}

export function latSpan(b: MapBounds): number {
  return b.maxLat - b.minLat;
}

// Center and zoom that roughly fit every point (the You filter's "everywhere"
// view). Web-mercator: each zoom level halves the degrees on screen, and a
// ~1000px view shows about 360° at zoom 0 × 4 tiles.
// ponytail: estimates from the widest span, no pixel math; fitBounds on each map if it's off.
export function fitPoints(points: { lat: number; lng: number }[]): { lat: number; lng: number; zoom: number } | null {
  if (points.length === 0) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const span = Math.max(maxLng - minLng, (maxLat - minLat) * 1.5, 0.02);
  const zoom = Math.max(2, Math.min(15, Math.floor(Math.log2(1440 / span)) - 1));
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2, zoom };
}
