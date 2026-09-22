// Client for the web app's /api/geocode and /api/reverse-geocode proxies (Nominatim) —
// mirrors fetchNearbyOsmShops in nearby-map-data.ts. Pure fetch/parse so it's testable
// without a running server. All the address-formatting knowledge (city/state/country,
// state abbreviation) lives server-side (apps/web/lib/geocode.ts); this just renders
// the primary/secondary strings it's handed.
import { boundsAround } from "./bounds";
import type { NearbyShopPin } from "../../components/map/types";

export type Place = { id: string; primary: string; secondary: string; lat: number; lng: number };

// Wide enough to cover a whole metro area (searching from one suburb for a
// shop across town) without turning into a state/country-wide query. Cheap
// at any size here since /api/nearby-shops always name-filters this
// request — it's a handful of matches, not a viewport dump of every cafe.
const SHOP_SEARCH_RADIUS_DEG = 1;

// Finds a coffee shop by name among live OSM data, not just ones already
// rated in our own DB — most searches early on are someone looking for a
// shop they've *already* been to, to rate or favorite it for the first time.
export async function searchNearbyShops(query: string, origin: { lat: number; lng: number }, webAppUrl: string): Promise<NearbyShopPin[]> {
  const bounds = boundsAround(origin, SHOP_SEARCH_RADIUS_DEG);
  const params = new URLSearchParams({
    minLat: String(bounds.minLat),
    minLng: String(bounds.minLng),
    maxLat: String(bounds.maxLat),
    maxLng: String(bounds.maxLng),
    q: query,
  });
  const response = await fetch(`${webAppUrl}/api/nearby-shops?${params}`);
  if (!response.ok) throw new Error(`nearby-shops search failed: ${response.status}`);
  const { shops } = (await response.json()) as { shops: NearbyShopPin[] };
  return shops;
}

export async function geocodePlaces(query: string, webAppUrl: string): Promise<Place[]> {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`${webAppUrl}/api/geocode?${params}`);
  if (!response.ok) throw new Error(`geocode request failed: ${response.status}`);
  const { places } = (await response.json()) as { places: Place[] };
  return places;
}

// The "City, ST, Country" trailing line for a shop's own coordinates — the shop's name
// is the headline, supplied by the caller, not by this lookup.
export async function reverseGeocode(lat: number, lng: number, webAppUrl: string): Promise<string> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  const response = await fetch(`${webAppUrl}/api/reverse-geocode?${params}`);
  if (!response.ok) throw new Error(`reverse-geocode request failed: ${response.status}`);
  const { secondary } = (await response.json()) as { secondary: string };
  return secondary;
}
