import type { MapBounds, NearbyShopPin, RatedShopPin } from "../../components/map/types";

type Point = { lat: number; lng: number };

// Chip labels follow the design ("Make the trip +" = verdicts 4 and 5). The
// design's "Open now" and "Quiet" chips are out of v1 (no hours parsing, no tags).
export type MapFilter = "all" | "rated" | "top";
export const MAP_FILTERS: { id: MapFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "rated", label: "Rated" },
  { id: "top", label: "Make the trip +" },
];

export type ListRow =
  | { kind: "rated"; shop: RatedShopPin; distanceKm: number | null }
  | { kind: "nearby"; shop: NearbyShopPin; distanceKm: number | null };

export function distanceKm(a: Point, b: Point): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(h));
}

// US-first: miles, like the design's "2.1 mi".
export function formatDistance(km: number): string {
  const miles = km * 0.621371;
  if (miles < 0.1) return "<0.1 mi";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

// The filter applies to the map's pins and to the list alike.
export function applyFilter(filter: MapFilter, rated: RatedShopPin[], nearby: NearbyShopPin[]) {
  if (filter === "all") return { rated, nearby };
  if (filter === "rated") return { rated, nearby: [] as NearbyShopPin[] };
  return { rated: rated.filter((s) => s.rating >= 4), nearby: [] as NearbyShopPin[] };
}

// Zoomed way out over a whole region, "nearby" can mean thousands of shops — the list
// stays useful (and fast) capped at this many rows. Rated-first ordering below means a
// cap never hides a top verdict in favor of an unrated dot.
export const MAX_ROWS = 50;

// Rated shops first (best verdict, then nearest), then unrated by distance.
// Without an origin (no location, no map yet) distance is null and unrated
// shops fall back to alphabetical.
export function buildRows(rated: RatedShopPin[], nearby: NearbyShopPin[], origin: Point | null): ListRow[] {
  const dist = (s: Point) => (origin ? distanceKm(origin, s) : null);
  const ratedRows: ListRow[] = rated
    .map((shop) => ({ kind: "rated" as const, shop, distanceKm: dist(shop) }))
    .sort((a, b) => b.shop.rating - a.shop.rating || (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  const nearbyRows: ListRow[] = nearby
    .map((shop) => ({ kind: "nearby" as const, shop, distanceKm: dist(shop) }))
    .sort((a, b) => (a.distanceKm !== null && b.distanceKm !== null ? a.distanceKm - b.distanceKm : a.shop.name.localeCompare(b.shop.name)));
  return [...ratedRows, ...nearbyRows].slice(0, MAX_ROWS);
}

// A café picked from search far from the loaded area shows (and stays selected)
// right away, before that area's OSM data arrives — then the real entry takes over.
// Skipped once it's rated (logged since it was picked) so it doesn't double up.
export function withPinned(nearby: NearbyShopPin[], pinned: NearbyShopPin | null, rated: { externalId: string | null }[] = []): NearbyShopPin[] {
  if (!pinned || nearby.some((s) => s.externalId === pinned.externalId) || rated.some((r) => r.externalId === pinned.externalId)) return nearby;
  return [...nearby, pinned];
}

// A rated shop logged from OSM is also in the live OSM layer; show it once, as the rated pin.
// A rated shop keeps the id it was first logged under: an OSM id ("node/123")
// from before the coffee index, or a cs_ id since. Index dots list every
// source id ("osm:node/123"), so either scheme finds its dot.
export function dropRatedDuplicates(nearby: NearbyShopPin[], rated: { externalId: string | null }[]): NearbyShopPin[] {
  const ratedIds = new Set(rated.map((r) => r.externalId).filter(Boolean));
  const osmId = (s: string) => (s.startsWith("osm:") ? s.slice(4) : s);
  return nearby.filter((n) => !ratedIds.has(n.externalId) && !(n.sourceIds ?? []).some((s) => ratedIds.has(osmId(s))));
}

// Dim index dots (cafés we have no reason to vouch for yet) only appear
// once the view is down to about a neighbourhood, so they never crowd out
// rated pins and the likelier specialty spots.
export const DIM_MAX_SPAN = 0.05;
export function visibleNearby(nearby: NearbyShopPin[], view: MapBounds): NearbyShopPin[] {
  return view.maxLat - view.minLat < DIM_MAX_SPAN ? nearby : nearby.filter((n) => n.visibility !== "dim");
}

export function rowSubtitle(row: ListRow): string {
  if (row.kind === "rated") {
    return [row.shop.neighborhood, row.shop.tag].filter(Boolean).join(" · ") || "Logged by the community";
  }
  return row.shop.address || "Not yet rated";
}
