import { describe, it, expect } from "vitest";
import { tileKey, toNearbyShop, buildOverpassQuery } from "./nearby-shops";

describe("tileKey", () => {
  it("rounds bounds to 2 decimal places so nearby pans share a key", () => {
    expect(tileKey(38.7051, -9.1401, 38.7099, -9.1349)).toBe(tileKey(38.7049, -9.1399, 38.7101, -9.1351));
  });

  it("produces different keys for distant boxes", () => {
    expect(tileKey(38.7, -9.1, 38.8, -9.0)).not.toBe(tileKey(40.7, -74.0, 40.8, -73.9));
  });

  it("produces different keys for a tight and a huge box sharing a center", () => {
    expect(tileKey(38.706, -9.144, 38.714, -9.136)).not.toBe(tileKey(35.0, -11.0, 42.42, -7.28));
  });
});

describe("buildOverpassQuery", () => {
  it("includes the bounding box and both node and way cafe queries", () => {
    const q = buildOverpassQuery({ minLat: 38.7, minLng: -9.2, maxLat: 38.8, maxLng: -9.1 });
    expect(q).toContain('node["amenity"="cafe"](38.7,-9.2,38.8,-9.1)');
    expect(q).toContain('way["amenity"="cafe"](38.7,-9.2,38.8,-9.1)');
  });

  it("also matches restaurants/bars tagged with a coffee_shop cuisine", () => {
    const q = buildOverpassQuery({ minLat: 38.7, minLng: -9.2, maxLat: 38.8, maxLng: -9.1 });
    expect(q).toContain('node["cuisine"~"coffee_shop"](38.7,-9.2,38.8,-9.1)');
    expect(q).toContain('way["cuisine"~"coffee_shop"](38.7,-9.2,38.8,-9.1)');
  });
});

describe("toNearbyShop", () => {
  it("maps a node element with full tags", () => {
    const shop = toNearbyShop({
      type: "node",
      id: 123,
      lat: 38.71,
      lon: -9.14,
      tags: {
        name: "Corner Cafe",
        "addr:housenumber": "12",
        "addr:street": "Rua do Ouro",
        opening_hours: "Mo-Fr 08:00-18:00",
        website: "https://cornercafe.pt",
        phone: "+351 21 000 0000",
      },
    });
    expect(shop).toEqual({
      externalId: "node/123",
      name: "Corner Cafe",
      lat: 38.71,
      lng: -9.14,
      address: "12 Rua do Ouro",
      hours: "Mo-Fr 08:00-18:00",
      website: "https://cornercafe.pt",
      phone: "+351 21 000 0000",
    });
  });

  it("maps a way element using its center point", () => {
    const shop = toNearbyShop({
      type: "way",
      id: 456,
      center: { lat: 38.72, lon: -9.15 },
      tags: { name: "Bean & Leaf" },
    });
    expect(shop).toEqual({
      externalId: "way/456",
      name: "Bean & Leaf",
      lat: 38.72,
      lng: -9.15,
      address: null,
      hours: null,
      website: null,
      phone: null,
    });
  });

  it("returns null when there's no name", () => {
    expect(toNearbyShop({ type: "node", id: 1, lat: 1, lon: 1, tags: {} })).toBeNull();
  });

  it("returns null when there's no position", () => {
    expect(toNearbyShop({ type: "way", id: 1, tags: { name: "Ghost Cafe" } })).toBeNull();
  });
});
