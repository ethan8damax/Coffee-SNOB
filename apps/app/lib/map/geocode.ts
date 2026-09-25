// Client for the web app's /api/search (Photon) and /api/nearby-shops proxies —
// mirrors fetchNearbyOsmShops in nearby-map-data.ts. Pure fetch/parse so it's testable
// without a running server. All the address-formatting knowledge (city/state/country,
// state abbreviation) lives server-side; this just renders the primary/secondary
// strings it's handed.
import { boundsAround } from "./bounds";
import type { NearbyShopPin } from "../../components/map/types";

// cityKey is set only for cities that have a city page (at least one rated shop).
export type Place = { id: string; primary: string; secondary: string; lat: number; lng: number; cityKey?: string | null };

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

// Cafés and places worldwide in one call (the web app's /api/search, Photon).
// The bias is rounded to ~10 km so nearby searchers share CDN-cached answers.
export async function searchEverywhere(
  query: string,
  origin: { lat: number; lng: number } | null,
  webAppUrl: string,
): Promise<{ places: Place[]; shops: { shop: NearbyShopPin; secondary: string }[] }> {
  const params = new URLSearchParams({ q: query });
  if (origin) {
    params.set("lat", origin.lat.toFixed(1));
    params.set("lng", origin.lng.toFixed(1));
  }
  const response = await fetch(`${webAppUrl}/api/search?${params}`);
  if (!response.ok) throw new Error(`search request failed: ${response.status}`);
  const body = (await response.json()) as {
    places: Place[];
    shops: { externalId: string; name: string; secondary: string; lat: number; lng: number }[];
  };
  return {
    places: body.places,
    shops: body.shops.map(({ externalId, name, secondary, lat, lng }) => ({
      shop: { externalId, name, lat, lng, address: null, hours: null, website: null, phone: null },
      secondary,
    })),
  };
}
