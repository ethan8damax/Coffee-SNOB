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

// Regex-escapes a user-typed search term, then quote-escapes it, so it's a
// literal case-insensitive substring match inside the Overpass QL query's
// own quoted string — never user-controlled regex.
function escapeOverpassName(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/"/g, '\\"');
}

// `name` narrows to shops whose OSM name matches — used for "search this
// shop by name" (searchNearbyShops), as opposed to the plain viewport fetch
// (fetchNearbyOsmShops) which wants every cafe in the box.
export function buildOverpassQuery(bounds: Bounds, name?: string): string {
  const { minLat, minLng, maxLat, maxLng } = bounds;
  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;
  const nameFilter = name ? `["name"~"${escapeOverpassName(name)}",i]` : "";
  // amenity=cafe alone misses plenty of real specialty-coffee spots that
  // live inside a restaurant/bar (a coffee-forward brunch spot, a bar that
  // does pour-overs by day) — OSM's convention there is a cuisine value of
  // "coffee_shop" (often alongside others, e.g. "mexican;coffee_shop")
  // rather than the amenity tag itself. Match on either.
  return `[out:json][timeout:25];(node["amenity"="cafe"]${nameFilter}(${bbox});way["amenity"="cafe"]${nameFilter}(${bbox});node["cuisine"~"coffee_shop"]${nameFilter}(${bbox});way["cuisine"~"coffee_shop"]${nameFilter}(${bbox}););out center;`;
}

export function toNearbyShop(el: OverpassElement): NearbyShop | null {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  const name = el.tags?.name;
  if (lat === undefined || lng === undefined || !name) return null;

  const tags = el.tags ?? {};
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const address = [street, tags["addr:city"]].filter(Boolean).join(", ");

  return {
    externalId: `${el.type}/${el.id}`,
    name,
    lat,
    lng,
    address: address || null,
    hours: tags["opening_hours"] ?? null,
    website: tags["website"] ?? tags["contact:website"] ?? null,
    phone: tags["phone"] ?? tags["contact:phone"] ?? null,
  };
}
