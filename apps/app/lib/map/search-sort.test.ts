import { describe, it, expect } from "vitest";
import { sortByDistance, type SearchResult } from "./search-sort";

const place = (id: string, lat: number, lng: number): SearchResult => ({
  kind: "place",
  place: { id, primary: id, secondary: "", lat, lng },
});
const shop = (id: string, lat: number, lng: number): SearchResult => ({
  kind: "shop",
  shop: { id, name: id, lat, lng, neighborhood: null, isSnobApproved: false, tag: null, priceTier: null, rating: 5, logCount: 1 },
  secondary: null,
});
const nearby = (id: string, lat: number, lng: number): SearchResult => ({
  kind: "nearby",
  shop: { externalId: id, name: id, lat, lng, address: null, hours: null, website: null, phone: null },
  secondary: null,
});

describe("sortByDistance", () => {
  const origin = { lat: 33.75, lng: -84.39 }; // Atlanta

  it("puts the closest result first, mixing places and shops", () => {
    const results = [place("far-country", 48.86, 2.35), shop("across-town", 33.8, -84.4), place("same-city", 33.76, -84.4)];
    expect(sortByDistance(results, origin).map((r) => (r.kind === "place" ? r.place.id : r.kind === "nearby" ? r.shop.externalId : r.shop.id))).toEqual([
      "same-city",
      "across-town",
      "far-country",
    ]);
  });

  it("sorts an unrated nearby match by distance same as any other result", () => {
    const results = [nearby("far", 48.86, 2.35), place("close", 33.76, -84.4)];
    const ids = sortByDistance(results, origin).map((r) => (r.kind === "place" ? r.place.id : r.kind === "nearby" ? r.shop.externalId : r.shop.id));
    expect(ids).toEqual(["close", "far"]);
  });

  it("leaves the order untouched when there's no origin", () => {
    const results = [place("b", 1, 1), place("a", 0, 0)];
    expect(sortByDistance(results, null)).toEqual(results);
  });
});
