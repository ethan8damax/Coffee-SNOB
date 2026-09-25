import { describe, expect, it } from "vitest";
import { fromOsm, fromOverture } from "../src/place";

describe("fromOsm", () => {
  it("maps a café node", () => {
    expect(fromOsm({
      type: "node", id: 123, name: "Spiller Park Coffee", amenity: "cafe", cuisine: ["coffee_shop"],
      brand: null, brand_wikidata: null, opening_hours: "Mo-Fr 07:00-15:00", website: "https://spillerpark.com",
      phone: null, lat: 33.77, lng: -84.36,
    })).toEqual({
      sourceId: "osm:node/123", name: "Spiller Park Coffee", lat: 33.77, lng: -84.36,
      address: null, locality: null, region: null, countryCode: null,
      website: "https://spillerpark.com", phone: null, hours: "Mo-Fr 07:00-15:00",
      category: "coffee_shop", cuisine: ["coffee_shop"], brand: null, brandWikidata: null,
      closed: false, datasets: ["OpenStreetMap"],
    });
  });

  it("calls a plain amenity=cafe a cafe, and drops nameless rows", () => {
    expect(fromOsm({ type: "way", id: 9, name: "Bean", amenity: "cafe", cuisine: null, brand: null, brand_wikidata: null, opening_hours: null, website: null, phone: null, lat: 1, lng: 2 })?.category).toBe("cafe");
    expect(fromOsm({ type: "node", id: 1, name: null, amenity: "cafe", cuisine: null, brand: null, brand_wikidata: null, opening_hours: null, website: null, phone: null, lat: 1, lng: 2 })).toBeNull();
  });
});

describe("fromOverture", () => {
  it("maps a place, keeping underlying datasets and closure", () => {
    const p = fromOverture({
      id: "08f2a", name: "East Pole Coffee Co", category: "coffee_shop", operating_status: "permanently_closed",
      website: null, phone: "+1 404 000 0000", brand_wikidata: null, brand_name: null,
      address: "255 Ottley Dr NE", locality: "Atlanta", region: "GA", country: "US",
      datasets: ["Foursquare", "Overture", "Overture-signals", "meta"], lat: 33.8, lng: -84.4,
    });
    expect(p).toMatchObject({
      sourceId: "ov:08f2a", category: "coffee_shop", cuisine: ["coffee_shop"], closed: true,
      locality: "Atlanta", countryCode: "US", datasets: ["Foursquare", "meta"],
    });
  });
});
