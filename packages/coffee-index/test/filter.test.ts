import { describe, expect, it } from "vitest";
import { keepPlace } from "../src/filter";
import { mergeCluster } from "../src/dedupe";
import { sp } from "./helpers";

const chains = [{ name: "starbucks", wikidata: "Q37158" }, { name: "dunkin", wikidata: null }];
const m = (p: Parameters<typeof sp>[0]) => mergeCluster([sp(p)]);

describe("keepPlace", () => {
  it("keeps an independent coffee shop", () => {
    expect(keepPlace(m({ sourceId: "osm:node/1", name: "Spiller Park Coffee", lat: 1, lng: 1 }), chains)).toBe(true);
  });
  it("drops chains by name, brand, or brand ID", () => {
    expect(keepPlace(m({ sourceId: "ov:a", name: "Starbucks Coffee Company", lat: 1, lng: 1, brandWikidata: "Q37158" }), chains)).toBe(false);
    expect(keepPlace(m({ sourceId: "ov:b", name: "Dunkin' Donuts", lat: 1, lng: 1 }), chains)).toBe(false);
    expect(keepPlace(m({ sourceId: "osm:node/2", name: "Midtown Plaza", lat: 1, lng: 1, brand: "Dunkin" }), chains)).toBe(false);
  });
  it("drops tea shops and closed places", () => {
    expect(keepPlace(m({ sourceId: "osm:node/3", name: "Kung Fu Tea", lat: 1, lng: 1, cuisine: ["bubble_tea"] }), chains)).toBe(false);
    expect(keepPlace(m({ sourceId: "ov:c", name: "Gone Coffee", lat: 1, lng: 1, closed: true }), chains)).toBe(false);
  });
});
