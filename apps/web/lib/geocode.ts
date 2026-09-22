// Place search ("city search") for the map's search bar — Nominatim, the reference
// OpenStreetMap geocoder: free, open-source, no API key, no per-account limits.
// Same fair-use shape as the Overpass proxy this app already runs (nearby-shops.ts):
// a custom User-Agent, and results cached rather than re-fetched. Pure, testable
// pieces here; the fetch + cache live in app/api/geocode/route.ts.

export type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
};

export type Place = { id: string; name: string; displayName: string; lat: number; lng: number };

export function toPlace(r: NominatimResult): Place | null {
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const name = r.name?.trim() || r.display_name.split(",")[0].trim();
  return { id: String(r.place_id), name, displayName: r.display_name, lat, lng };
}
