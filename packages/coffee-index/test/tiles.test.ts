import { describe, expect, it } from "vitest";
import { tileKey, toTiles } from "../src/tiles";

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
