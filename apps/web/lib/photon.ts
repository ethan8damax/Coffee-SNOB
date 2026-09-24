import { abbreviateCountry, abbreviateState, formatShopLocation } from "./geocode";
import { isChain, isCoffeePlace, type ChainEntry } from "./nearby-shops";

// Photon (komoot's OpenStreetMap geocoder, photon.komoot.io) powers the map's
// search box: cafés and places worldwide in one fast, typo-tolerant call, with
// city/state on every result. Pure mapping here; fetch + cache in
// app/api/search/route.ts.
export type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type: "N" | "W" | "R";
    osm_id: number;
    osm_key: string;
    osm_value: string;
    name?: string;
    city?: string;
    state?: string;
    countrycode?: string;
  };
};

export type Place = { id: string; primary: string; secondary: string; lat: number; lng: number };
export type SearchHit =
  | { kind: "place"; place: Place }
  | { kind: "shop"; externalId: string; name: string; secondary: string; lat: number; lng: number };

const OSM_TYPE = { N: "node", W: "way", R: "relation" } as const;
// Real places people search for — not OSM's "locality"/"isolated_dwelling"
// noise ("Blue Bottle Terrace", a Colombian hamlet named "Muchacho").
const PLACE_VALUES = new Set(["city", "town", "village", "hamlet", "suburb", "borough", "quarter", "neighbourhood", "state", "country"]);

export function toSearchHit(f: PhotonFeature, chains: ChainEntry[]): SearchHit | null {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  if (!p.name) return null;
  if (p.osm_key === "place" && PLACE_VALUES.has(p.osm_value)) {
    const country = p.countrycode ? abbreviateCountry(p.countrycode) : "";
    const secondary =
      p.osm_value === "country" ? "" :
      p.osm_value === "state" ? country :
      [p.state ? abbreviateState(p.state, p.countrycode) : null, country].filter(Boolean).join(", ");
    return { kind: "place", place: { id: `${p.osm_type}${p.osm_id}`, primary: p.name, secondary, lat, lng } };
  }
  // Cafés only: Photon can't filter restaurants/bars by cuisine, so coffee-
  // serving restaurants come from the local Overpass search instead.
  if (p.osm_key !== "amenity" || p.osm_value !== "cafe") return null;
  const tags = { name: p.name };
  if (!isCoffeePlace(tags) || isChain(tags, chains)) return null;
  return {
    kind: "shop",
    externalId: `${OSM_TYPE[p.osm_type]}/${p.osm_id}`,
    name: p.name,
    secondary: formatShopLocation({ city: p.city, state: p.state, country_code: p.countrycode }),
    lat,
    lng,
  };
}
