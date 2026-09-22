import { describe, it, expect } from "vitest";
import { sortByDistance, type SearchResult } from "./search-sort";

const place = (id: string, lat: number, lng: number): SearchResult => ({
  kind: "place",
  place: { id, name: id, displayName: id, lat, lng },
});
const shop = (id: string, lat: number, lng: number): SearchResult => ({
  kind: "shop",
  shop: { id, name: id, lat, lng, neighborhood: null, isSnobApproved: false, tag: null, priceTier: null, rating: 5, logCount: 1 },
});

describe("sortByDistance", () => {
  const origin = { lat: 33.75, lng: -84.39 }; // Atlanta

  it("puts the closest result first, mixing places and shops", () => {
    const results = [place("far-country", 48.86, 2.35), shop("across-town", 33.8, -84.4), place("same-city", 33.76, -84.4)];
    expect(sortByDistance(results, origin).map((r) => (r.kind === "place" ? r.place.id : r.shop.id))).toEqual([
      "same-city",
      "across-town",
      "far-country",
    ]);
  });

  it("leaves the order untouched when there's no origin", () => {
    const results = [place("b", 1, 1), place("a", 0, 0)];
    expect(sortByDistance(results, null)).toEqual(results);
  });
});
