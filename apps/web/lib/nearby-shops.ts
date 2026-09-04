// The "any shop nearby" layer — live OpenStreetMap data via Overpass, never
// bulk-imported (see docs/superpowers/specs/2026-09-03-map-community-shops-
// design.md). These are pure, easily-testable pieces of the proxy endpoint
// in app/api/nearby-shops/route.ts.

export type OverpassElement = {
  type: "node" | "way";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type NearbyShop = {
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  hours: string | null;
  website: string | null;
  phone: string | null;
};

export type Bounds = { minLat: number; minLng: number; maxLat: number; maxLng: number };

// Keyed on the box's center, rounded to ~0.01 degrees (~1km), so small pans
// or zoom jitter around the same spot share a cache entry instead of each
// pixel of movement missing the cache. (Corner-by-corner rounding doesn't
// work here: two boxes centered on the same point but with slightly
// different spans can round each corner to a different tile.)
export function tileKey(minLat: number, minLng: number, maxLat: number, maxLng: number): string {
  const round = (n: number) => Math.round(n * 100) / 100;
  return `${round((minLat + maxLat) / 2)},${round((minLng + maxLng) / 2)}`;
}

export function buildOverpassQuery(bounds: Bounds): string {
  const { minLat, minLng, maxLat, maxLng } = bounds;
  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;
  return `[out:json][timeout:25];(node["amenity"="cafe"](${bbox});way["amenity"="cafe"](${bbox}););out center;`;
}

export function toNearbyShop(el: OverpassElement): NearbyShop | null {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  const name = el.tags?.name;
  if (lat === undefined || lng === undefined || !name) return null;

  const tags = el.tags ?? {};
  const addressParts = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean);

  return {
    externalId: `${el.type}/${el.id}`,
    name,
    lat,
    lng,
    address: addressParts.length ? addressParts.join(" ") : null,
    hours: tags["opening_hours"] ?? null,
    website: tags["website"] ?? tags["contact:website"] ?? null,
    phone: tags["phone"] ?? tags["contact:phone"] ?? null,
  };
}
