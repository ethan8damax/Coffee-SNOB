import { describe, it, expect } from "vitest";
import { mergeResults, rankResults, type SearchResult } from "./search-sort";

const place = (id: string, primary: string, lat: number, lng: number): SearchResult => ({ kind: "place", place: { id, primary, secondary: "", lat, lng } });
const nearby = (externalId: string, name: string, lat: number, lng: number): SearchResult => ({
  kind: "nearby", secondary: null,
  shop: { externalId, name, lat, lng, address: null, hours: null, website: null, phone: null },
});
const rated = (id: string, name: string, lat: number, lng: number, externalId: string | null = null): SearchResult => ({
  kind: "shop", secondary: null,
  shop: { id, name, lat, lng, neighborhood: null, isSnobApproved: false, tag: null, priceTier: null, rating: 4, logCount: 1, externalId },
});
const key = (r: SearchResult) => (r.kind === "place" ? r.place.id : r.kind === "shop" ? r.shop.id : r.shop.externalId);
const nashville = { lat: 36.16, lng: -86.78 };

describe("mergeResults", () => {
  it("dedupes by OSM id, keeping the rated version", () => {
    const merged = mergeResults([nearby("way/1", "Muchacho", 33.7, -84.3)], [rated("s1", "Muchacho", 33.7, -84.3, "way/1"), nearby("node/2", "Other", 0, 0)]);
    expect(merged.map(key)).toEqual(["s1", "node/2"]);
    expect(mergeResults(merged, [nearby("way/1", "Muchacho", 33.7, -84.3)]).map(key)).toEqual(["s1", "node/2"]);
  });

  it("dedupes places by id", () => {
    expect(mergeResults([place("R1", "Atlanta", 33.7, -84.4)], [place("R1", "Atlanta", 33.7, -84.4)]).map(key)).toEqual(["R1"]);
  });
});

describe("rankResults", () => {
  it("puts exact and prefix name matches first, then rated, then nearest", () => {
    const results = [
      nearby("node/9", "The Dancing Goats Coffee Bar", 33.77, -84.36),
      place("R2", "Atlanta", 33.75, -84.39),
      nearby("node/1", "Dancing Goats Coffee", 33.75, -84.36),
      rated("s1", "Dancing Goats Coffee", 33.78, -84.29),
      nearby("node/3", "Nashville Dancing Goats", 36.16, -86.78),
    ];
    // Tiers: s1 + node/1 start with the query (tier 1, rated first); node/3 and
    // node/9 contain it at a later word (tier 2, nearest to Nashville first); R2 doesn't match.
    expect(rankResults(results, "dancing goats", nashville).map(key)).toEqual(["s1", "node/1", "node/3", "node/9", "R2"]);
  });

  it("puts the exact city first when searching a place", () => {
    const results = [place("R3", "Atlanta", 33.07, -94.16), nearby("node/5", "Atlanta Coffee Roasters", 33.75, -84.39), place("R1", "Atlanta", 33.75, -84.39)];
    expect(rankResults(results, "atlanta", nashville).map(key)).toEqual(["R1", "R3", "node/5"]);
  });

  it("ignores accents, case and punctuation when matching", () => {
    const results = [nearby("node/2", "Other Cafe", 0, 0), nearby("node/1", "Café Kitsuné", 0, 0)];
    expect(rankResults(results, "cafe kitsune", null).map(key)).toEqual(["node/1", "node/2"]);
  });
});
