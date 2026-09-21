import { describe, it, expect } from "vitest";
import { BASEMAP } from "./basemap";

describe("BASEMAP", () => {
  it("points at an https style document", () => {
    expect(BASEMAP.styleUrl.startsWith("https://")).toBe(true);
  });

  it("always credits OpenStreetMap and OpenMapTiles (required by the data licenses)", () => {
    expect(BASEMAP.attribution).toContain("OpenStreetMap");
    expect(BASEMAP.attribution).toContain("OpenMapTiles");
  });
});
