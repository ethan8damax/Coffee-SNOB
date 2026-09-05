import { describe, it, expect } from "vitest";
import { boundsAround } from "./bounds";

describe("boundsAround", () => {
  it("builds a symmetric box around the center point", () => {
    expect(boundsAround({ lat: 38.71, lng: -9.14 }, 0.03)).toEqual({
      minLat: 38.68,
      maxLat: 38.74,
      minLng: -9.17,
      maxLng: -9.11,
    });
  });

  it("scales with a different span", () => {
    expect(boundsAround({ lat: 40, lng: -74 }, 0.1)).toEqual({
      minLat: 39.9,
      maxLat: 40.1,
      minLng: -74.1,
      maxLng: -73.9,
    });
  });
});
