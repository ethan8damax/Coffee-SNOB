// Client for the web app's /api/geocode proxy (Nominatim) — mirrors
// fetchNearbyOsmShops in nearby-map-data.ts. Pure fetch/parse so it's testable
// without a running server.
export type Place = { id: string; name: string; displayName: string; lat: number; lng: number };

export async function geocodePlaces(query: string, webAppUrl: string): Promise<Place[]> {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`${webAppUrl}/api/geocode?${params}`);
  if (!response.ok) throw new Error(`geocode request failed: ${response.status}`);
  const { places } = (await response.json()) as { places: Place[] };
  return places;
}
