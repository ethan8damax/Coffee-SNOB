import { describe, expect, it } from "vitest";
import { clusterPlaces, mergeCluster, nameKey, similarity } from "../src/dedupe";
import { sp } from "./helpers";

const M = 0.0001; // ~11 m of latitude

describe("names", () => {
  it("normalizes punctuation and quotes away", () => {
    expect(nameKey('Spiller Park Coffee "SP1"')).toBe("spiller park coffee sp1");
    expect(similarity("East Pole Coffee Co", "East Pole Coffee Co.")).toBe(1);
    expect(similarity("Refuge Coffee Co. Midtown", "Refuge Coffee")).toBeGreaterThanOrEqual(0.5);
    expect(similarity("Starbucks", "Refuge Coffee")).toBe(0);
  });
});

describe("clusterPlaces", () => {
  it("merges the same café from two sources a few metres apart", () => {
    const c = clusterPlaces([
      sp({ sourceId: "osm:node/1", name: "East Pole Coffee Co", lat: 33.8, lng: -84.4 }),
      sp({ sourceId: "ov:a", name: "East Pole Coffee Co.", lat: 33.8 + 2 * M, lng: -84.4 }),
    ], 50, 0.5);
    expect(c).toHaveLength(1);
  });

  it("merges a leading-words match (branch suffix)", () => {
    const c = clusterPlaces([
      sp({ sourceId: "osm:node/1", name: "Spiller Park Coffee", lat: 33.77, lng: -84.36 }),
      sp({ sourceId: "ov:b", name: 'Spiller Park Coffee "SP1"', lat: 33.77, lng: -84.36 + M }),
    ], 50, 0.5);
    expect(c).toHaveLength(1);
  });

  it("merges merely similar names only when website or phone match", () => {
    const a = sp({ sourceId: "osm:node/1", name: "Refuge Coffee", lat: 1, lng: 1, website: "https://refugecoffeeco.com/" });
    const b = sp({ sourceId: "ov:c", name: "Midtown Refuge Coffee", lat: 1 + M, lng: 1, website: "http://www.refugecoffeeco.com/midtown" });
    expect(clusterPlaces([a, b], 50, 0.5)).toHaveLength(1);
    expect(clusterPlaces([a, { ...b, website: null }], 50, 0.5)).toHaveLength(2);
  });

  it("keeps different names apart, and same names far apart", () => {
    expect(clusterPlaces([
      sp({ sourceId: "osm:node/1", name: "Starbucks", lat: 1, lng: 1 }),
      sp({ sourceId: "osm:node/2", name: "Refuge Coffee", lat: 1, lng: 1 }),
    ], 50, 0.5)).toHaveLength(2);
    expect(clusterPlaces([
      sp({ sourceId: "osm:node/1", name: "Refuge Coffee", lat: 1, lng: 1 }),
      sp({ sourceId: "osm:node/2", name: "Refuge Coffee", lat: 1 + 10 * M, lng: 1 }),
    ], 50, 0.5)).toHaveLength(2);
  });

  it("finds neighbours across a cell edge at high latitude", () => {
    const c = clusterPlaces([
      sp({ sourceId: "osm:node/1", name: "Kaffebrenneriet", lat: 69.649, lng: 18.955 }),
      sp({ sourceId: "ov:d", name: "Kaffebrenneriet", lat: 69.649, lng: 18.9559 }),
    ], 50, 0.5);
    expect(c).toHaveLength(1);
  });
});

describe("mergeCluster", () => {
  it("takes names/addresses from Overture, hours and position from OSM", () => {
    const m = mergeCluster([
      sp({ sourceId: "ov:a", name: "East Pole Coffee Co.", lat: 33.80002, lng: -84.4, address: "255 Ottley Dr", locality: "Atlanta", countryCode: "US", category: "coffee_shop", datasets: ["Foursquare"] }),
      sp({ sourceId: "osm:node/1", name: "East Pole", lat: 33.8, lng: -84.4, hours: "Mo-Su 08:00-16:00", category: "cafe", datasets: ["OpenStreetMap"] }),
    ]);
    expect(m).toMatchObject({
      sourceIds: ["ov:a", "osm:node/1"], name: "East Pole Coffee Co.", lat: 33.8, address: "255 Ottley Dr",
      hours: "Mo-Su 08:00-16:00", category: "coffee_shop", datasets: ["Foursquare", "OpenStreetMap"], closed: false,
    });
  });

  it("is closed only when every Overture record says so", () => {
    expect(mergeCluster([sp({ sourceId: "ov:a", name: "X", lat: 1, lng: 1, closed: true })]).closed).toBe(true);
    expect(mergeCluster([
      sp({ sourceId: "ov:a", name: "X", lat: 1, lng: 1, closed: true }),
      sp({ sourceId: "ov:b", name: "X", lat: 1, lng: 1 }),
    ]).closed).toBe(false);
  });
});
