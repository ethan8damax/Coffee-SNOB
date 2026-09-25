import type { SourcePlace } from "../src/place";

export function sp(p: Partial<SourcePlace> & Pick<SourcePlace, "sourceId" | "name" | "lat" | "lng">): SourcePlace {
  return {
    address: null, locality: null, region: null, countryCode: null,
    website: null, phone: null, hours: null, category: null, cuisine: [],
    brand: null, brandWikidata: null, closed: false, datasets: [],
    ...p,
  };
}
