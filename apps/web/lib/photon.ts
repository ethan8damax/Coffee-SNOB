import { cityKey } from "@coffeesnob/supabase";
import { abbreviateCountry, abbreviateState, formatShopLocation } from "./geocode";
import { isChain, isCoffeePlace, type ChainEntry } from "@coffeesnob/coffee-index";

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
    county?: string;
    state?: string;
    countrycode?: string;
  };
};

export type Locality = { locality: string | null; region: string | null; countryCode: string | null };

// A shop's city for its city page (/api/locate). Near a town's center the
// nearest feature is often the town's own place node, which has no `city` —
// use its name. Unincorporated spots get no city (no county pages: search
// never links to them).
export function toLocality(f: PhotonFeature | undefined): Locality {
  const p = f?.properties;
  const town = p && p.osm_key === "place" && CITY_VALUES.has(p.osm_value) ? p.name : undefined;
  return {
    locality: p?.city ?? town ?? null,
    region: p?.state ?? null,
    countryCode: p?.countrycode ? p.countrycode.toUpperCase() : null,
  };
}

// cityKey: the city page this place would have (city-level places only); the
// search route clears it unless that city has rated shops.
export type Place = { id: string; primary: string; secondary: string; lat: number; lng: number; cityKey: string | null };
export type SearchHit =
  | { kind: "place"; place: Place }
  | { kind: "shop"; externalId: string; name: string; secondary: string; lat: number; lng: number };

const OSM_TYPE = { N: "node", W: "way", R: "relation" } as const;
const CITY_VALUES = new Set(["city", "town", "village", "hamlet"]);
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
    const key = CITY_VALUES.has(p.osm_value) ? cityKey(p.name, p.state, p.countrycode) : null;
    return { kind: "place", place: { id: `${p.osm_type}${p.osm_id}`, primary: p.name, secondary, lat, lng, cityKey: key } };
  }
  // Cafés only: Photon can't filter restaurants/bars by cuisine, so coffee-
  // serving restaurants come from the local Overpass search instead.
  if (p.osm_key !== "amenity" || p.osm_value !== "cafe") return null;
  const tags = { name: p.name };
  // Photon returns no brand:wikidata, so match every chain by name prefix
  // (isChain only does that for entries without an ID) — else "Dunkin Donuts"
  // slips past the "dunkin" entry.
  const byName = chains.map((c) => ({ ...c, wikidata: null }));
  if (!isCoffeePlace(tags) || isChain(tags, byName)) return null;
  return {
    kind: "shop",
    externalId: `${OSM_TYPE[p.osm_type]}/${p.osm_id}`,
    name: p.name,
    secondary: formatShopLocation({ city: p.city, state: p.state, country_code: p.countrycode }),
    lat,
    lng,
  };
}
