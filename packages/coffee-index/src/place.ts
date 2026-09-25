import { config } from "./config";

// One place as a single source describes it. Source ids: "osm:node/123",
// "osm:way/456" (shops.external_id minus the prefix), "ov:<GERS id>".
export type SourcePlace = {
  sourceId: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  locality: string | null;
  region: string | null;
  countryCode: string | null;
  website: string | null;
  phone: string | null;
  hours: string | null;
  category: string | null;
  cuisine: string[];
  brand: string | null;
  brandWikidata: string | null;
  closed: boolean;
  // Who vouches for it: "OpenStreetMap", or Overture's upstream datasets
  // (Foursquare, meta, Microsoft, …) without Overture's own bookkeeping.
  datasets: string[];
};

// A dedupe cluster folded into one place.
export type MergedPlace = Omit<SourcePlace, "sourceId"> & { sourceIds: string[] };

export type IndexPlace = MergedPlace & { id: string; visibility: "show" | "dim"; why: string[] };

export type OsmRow = {
  type: string; id: number | string; name: string | null; amenity: string | null; cuisine: string[] | null;
  brand: string | null; brand_wikidata: string | null; opening_hours: string | null;
  website: string | null; phone: string | null; lat: number; lng: number;
};

export type OvertureRow = {
  id: string; name: string | null; category: string | null; operating_status: string | null;
  website: string | null; phone: string | null; brand_wikidata: string | null; brand_name: string | null;
  address: string | null; locality: string | null; region: string | null; country: string | null;
  datasets: string[] | null; lat: number; lng: number;
};

export function fromOsm(r: OsmRow): SourcePlace | null {
  if (!r.name) return null;
  const cuisine = r.cuisine ?? [];
  return {
    sourceId: `osm:${r.type}/${r.id}`,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    address: null,
    locality: null,
    region: null,
    countryCode: null,
    website: r.website,
    phone: r.phone,
    hours: r.opening_hours,
    category: cuisine.includes("coffee_shop") ? "coffee_shop" : r.amenity === "cafe" ? "cafe" : null,
    cuisine,
    brand: r.brand,
    brandWikidata: r.brand_wikidata,
    closed: false,
    datasets: ["OpenStreetMap"],
  };
}

export function fromOverture(r: OvertureRow): SourcePlace | null {
  if (!r.name) return null;
  const coffeeShop = r.category !== null && config.coffeeShopCategories.includes(r.category);
  return {
    sourceId: `ov:${r.id}`,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    address: r.address,
    locality: r.locality,
    region: r.region,
    countryCode: r.country,
    website: r.website,
    phone: r.phone,
    hours: null,
    category: r.category,
    // Lets isCoffeePlace treat Overture's coffee categories like OSM's cuisine tag.
    cuisine: coffeeShop ? ["coffee_shop"] : [],
    brand: r.brand_name,
    brandWikidata: r.brand_wikidata,
    closed: r.operating_status === "permanently_closed",
    datasets: [...new Set((r.datasets ?? []).filter((d) => !d.startsWith("Overture")))],
  };
}
