import { describe, it, expect } from "vitest";
import { boundsAround, containsBounds, padBounds } from "./bounds";

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

describe("padBounds / containsBounds", () => {
  const box = { minLat: 10, maxLat: 12, minLng: 20, maxLng: 24 };
  it("pads each side by a fraction of the box size", () => {
    expect(padBounds(box, 0.5)).toEqual({ minLat: 9, maxLat: 13, minLng: 18, maxLng: 26 });
  });
  it("detects whether a viewport is inside the fetched box", () => {
    const padded = padBounds(box, 0.5);
    expect(containsBounds(padded, box)).toBe(true);
    expect(containsBounds(padded, { ...box, maxLng: 27 })).toBe(false);
  });
});
