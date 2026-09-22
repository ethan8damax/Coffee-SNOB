import { distanceKm } from "./shop-list";
import type { Place } from "./geocode";
import type { RatedShopPin } from "../../components/map/types";

// A shop's "City, ST, Country" line comes from a reverse-geocode lookup on its
// coordinates; null means that lookup failed (never shown as a loading state — see
// map-search.tsx, results aren't set until every lookup in the batch settles).
export type SearchResult = { kind: "place"; place: Place } | { kind: "shop"; shop: RatedShopPin; secondary: string | null };

function resultPoint(r: SearchResult) {
  return r.kind === "place" ? r.place : r.shop;
}

// Closest first when we know roughly where "me" is — otherwise a same-named place on
// the other side of the world can outrank the one right here.
export function sortByDistance(results: SearchResult[], origin: { lat: number; lng: number } | null): SearchResult[] {
  if (!origin) return results;
  return [...results].sort((a, b) => distanceKm(origin, resultPoint(a)) - distanceKm(origin, resultPoint(b)));
}
