import { describe, it, expect } from "vitest";
import { BASEMAP } from "./basemap";

describe("BASEMAP", () => {
  it("is a standard XYZ raster template", () => {
    expect(BASEMAP.url).toContain("{z}");
    expect(BASEMAP.url).toContain("{x}");
    expect(BASEMAP.url).toContain("{y}");
    expect(BASEMAP.url.startsWith("https://")).toBe(true);
  });

  it("always credits OpenStreetMap contributors (required by the data license)", () => {
    expect(BASEMAP.attribution).toContain("OpenStreetMap");
  });

  it("carries a warm tint filter toward the design's paper palette", () => {
    expect(BASEMAP.tintFilter).toMatch(/sepia\(/);
  });
});
