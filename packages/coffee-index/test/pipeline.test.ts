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

  it("gives OSM-only places the nearest known country", () => {
    const { places } = buildIndex({ ...input, osm: [...input.osm, osm(3, "Chrome Yellow", 33.76, -84.37)] });
    expect(places.find((p) => p.name === "Chrome Yellow")?.countryCode).toBe("US");
  });

  it("applies admin overrides and 'not specialty' reports", () => {
    const base = buildIndex(input);
    const id = base.places[0].id;
    expect(buildIndex({ ...input, prevIdMap: base.idMap, overrides: [{ placeId: id, action: "hide" }] }).places).toHaveLength(0);
    const flagged = buildIndex({ ...input, prevIdMap: base.idMap, notSpecialty: { [id]: 5 } }).places[0];
    expect(flagged.visibility).toBe("dim");
    const picked = buildIndex({ ...input, prevIdMap: base.idMap, notSpecialty: { [id]: 5 }, overrides: [{ placeId: id, action: "show" }] }).places[0];
    expect(picked).toMatchObject({ visibility: "show", why: ["picked by Coffee Snob"] });
  });

  it("keeps a hidden place's id in the map, so unhiding brings the same id back", () => {
    const base = buildIndex(input);
    const id = base.places[0].id;
    const hidden = buildIndex({ ...input, prevIdMap: base.idMap, overrides: [{ placeId: id, action: "hide" }] });
    expect(Object.values(hidden.idMap)).toContain(id);
  });

  it("keeps ids stable across two builds", () => {
    const one = buildIndex(input);
    const two = buildIndex({ ...input, prevIdMap: one.idMap, prevIds: new Set(one.places.map((p) => p.id)) });
    expect(two.places[0].id).toBe(one.places[0].id);
    expect(two.report).toMatchObject({ added: 0, removed: 0, alarm: null });
  });
});
