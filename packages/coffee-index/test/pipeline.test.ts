import { describe, expect, it } from "vitest";
import { buildIndex } from "../src/pipeline";

const osm = (id: number, name: string, lat: number, lng: number, extra: Record<string, unknown> = {}) => ({
  type: "node", id, name, amenity: "cafe", cuisine: null, brand: null, brand_wikidata: null,
  opening_hours: null, website: null, phone: null, lat, lng, ...extra,
});
const ov = (id: string, name: string, lat: number, lng: number, extra: Record<string, unknown> = {}) => ({
  id, name, category: "coffee_shop", operating_status: "open", website: null, phone: null,
  brand_wikidata: null, brand_name: null, address: null, locality: "Atlanta", region: "GA", country: "US",
  datasets: ["Foursquare"], lat, lng, ...extra,
});

describe("buildIndex", () => {
  const input = {
    osm: [osm(1, "East Pole Coffee Co", 33.8, -84.4), osm(2, "Kung Fu Tea", 33.75, -84.38, { cuisine: ["bubble_tea"] })],
    overture: [ov("a", "East Pole Coffee Co.", 33.80001, -84.4), ov("b", "Starbucks", 33.76, -84.38, { brand_wikidata: "Q37158" })],
    chains: [{ name: "starbucks", wikidata: "Q37158" }],
    prevIdMap: {},
    prevIds: null,
  };

  it("merges, filters and scores end to end", () => {
    const { places, report } = buildIndex(input);
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ name: "East Pole Coffee Co.", sourceIds: ["ov:a", "osm:node/1"], visibility: "show", locality: "Atlanta" });
    expect(report.count).toBe(1);
  });

  it("keeps ids stable across two builds", () => {
    const one = buildIndex(input);
    const two = buildIndex({ ...input, prevIdMap: one.idMap, prevIds: new Set(one.places.map((p) => p.id)) });
    expect(two.places[0].id).toBe(one.places[0].id);
    expect(two.report).toMatchObject({ added: 0, removed: 0, alarm: null });
  });
});
