import { describe, it, expect } from "vitest";
import { boundsAround, containsBounds, latSpan, padBounds, snapToGrid, withinBounds } from "./bounds";

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

describe("snapToGrid", () => {
  it("grows a box outward to the grid so nearby views request the same box", () => {
    expect(snapToGrid({ minLat: 33.74, minLng: -84.41, maxLat: 33.78, maxLng: -84.37 }, 0.1))
      .toEqual({ minLat: 33.7, minLng: -84.5, maxLat: 33.8, maxLng: -84.3 });
    expect(snapToGrid({ minLat: 33.71, minLng: -84.49, maxLat: 33.79, maxLng: -84.31 }, 0.1))
      .toEqual({ minLat: 33.7, minLng: -84.5, maxLat: 33.8, maxLng: -84.3 });
  });
});

describe("latSpan", () => {
  it("is the box's height in degrees", () => {
    expect(latSpan({ minLat: 33.7, minLng: 0, maxLat: 33.9, maxLng: 1 })).toBeCloseTo(0.2);
  });
});

describe("withinBounds", () => {
  const box = { minLat: 10, maxLat: 12, minLng: 20, maxLng: 24 };
  it("is true for a point inside, including on the edge", () => {
    expect(withinBounds(box, 11, 22)).toBe(true);
    expect(withinBounds(box, 10, 20)).toBe(true);
    expect(withinBounds(box, 12, 24)).toBe(true);
  });
  it("is false for a point outside on any side", () => {
    expect(withinBounds(box, 9, 22)).toBe(false);
    expect(withinBounds(box, 13, 22)).toBe(false);
    expect(withinBounds(box, 11, 19)).toBe(false);
    expect(withinBounds(box, 11, 25)).toBe(false);
  });
});
