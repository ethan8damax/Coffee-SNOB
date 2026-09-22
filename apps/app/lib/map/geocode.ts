// Client for the web app's /api/geocode and /api/reverse-geocode proxies (Nominatim) —
// mirrors fetchNearbyOsmShops in nearby-map-data.ts. Pure fetch/parse so it's testable
// without a running server. All the address-formatting knowledge (city/state/country,
// state abbreviation) lives server-side (apps/web/lib/geocode.ts); this just renders
// the primary/secondary strings it's handed.
export type Place = { id: string; primary: string; secondary: string; lat: number; lng: number };

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
