import { describe, it, expect } from "vitest";
import { toNearbyShop, buildOverpassQuery } from "./nearby-shops";

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

  it("adds a case-insensitive name filter to every clause when searching by name", () => {
    const q = buildOverpassQuery({ minLat: 38.7, minLng: -9.2, maxLat: 38.8, maxLng: -9.1 }, "Muchacho");
    expect(q).toContain('node["amenity"="cafe"]["name"~"Muchacho",i](38.7,-9.2,38.8,-9.1)');
    expect(q).toContain('way["cuisine"~"coffee_shop"]["name"~"Muchacho",i](38.7,-9.2,38.8,-9.1)');
  });

  it("escapes regex metacharacters and quotes in a searched name", () => {
    const q = buildOverpassQuery({ minLat: 0, minLng: 0, maxLat: 1, maxLng: 1 }, 'Foo (bar)+ "baz"');
    expect(q).toContain('"name"~"Foo \\(bar\\)\\+ \\"baz\\"",i');
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
        "addr:city": "Lisboa",
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
      address: "12 Rua do Ouro, Lisboa",
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
