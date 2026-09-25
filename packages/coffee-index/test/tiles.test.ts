import { describe, expect, it } from "vitest";
import { layoutTiles, searchRows, tileKey, toTiles } from "../src/tiles";

describe("tiles", () => {
  it("keys by the cell's south-west corner on the app's 0.1° grid", () => {
    expect(tileKey(33.77, -84.36, 0.1)).toBe("33.7_-84.4");
    expect(tileKey(-33.87, 151.21, 0.1)).toBe("-33.9_151.2");
    expect(tileKey(33.7, -84.4, 0.1)).toBe("33.7_-84.4");
  });
  it("groups places into their cells", () => {
    const t = toTiles([{ id: "cs_1", lat: 33.77, lng: -84.36 }, { id: "cs_2", lat: 33.71, lng: -84.39 }, { id: "cs_3", lat: 40.7, lng: -74 }], 0.1);
    expect([...t.keys()].sort()).toEqual(["33.7_-84.4", "40.7_-74"]);
    expect(t.get("33.7_-84.4")).toHaveLength(2);
  });
});

describe("layoutTiles", () => {
  const cfg = { tileStep: 0.1, splitStep: 0.025, splitAbove: 2 };
  it("keeps sparse cells whole and splits dense ones into fine cells", () => {
    const places = [
      { id: "a", lat: 33.71, lng: -84.39 },
      { id: "b", lat: 10.701, lng: 106.601 }, { id: "c", lat: 10.701, lng: 106.602 }, { id: "d", lat: 10.79, lng: 106.69 },
    ];
    const { coarse, fine, split } = layoutTiles(places, cfg);
    expect([...coarse.keys()]).toEqual(["33.7_-84.4"]);
    expect(split).toEqual(["10.7_106.6"]);
    expect(new Set(fine.keys())).toEqual(new Set(["10.7_106.6", "10.775_106.675"]));
  });
});

describe("searchRows", () => {
  it("groups compact rows by 1° cell", () => {
    const rows = searchRows([{ id: "cs_1", name: "Perc", lat: 33.78, lng: -84.35 }], 1);
    expect(rows.get("33_-85")).toEqual([["cs_1", "Perc", 33.78, -84.35]]);
  });
});
