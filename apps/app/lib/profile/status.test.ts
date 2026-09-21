import { describe, it, expect } from "vitest";
import { buildHeatmap, heatLevel, heatmapSince, snobStatus } from "./status";

describe("snobStatus", () => {
  it("climbs the ladder at each threshold", () => {
    expect(snobStatus(0).name).toBe("Beginner");
    expect(snobStatus(4).name).toBe("Beginner");
    expect(snobStatus(5).name).toBe("Regular");
    expect(snobStatus(30).name).toBe("Snob");
    expect(snobStatus(500).name).toBe("Head Snob");
  });
  it("says how many logs to the next tier, none at the top", () => {
    expect(snobStatus(3).next).toEqual({ name: "Regular", needed: 2 });
    expect(snobStatus(60).next).toBeNull();
  });
  it("treats junk counts as 0", () => {
    expect(snobStatus(-3).name).toBe("Beginner");
    expect(snobStatus(Number.NaN).name).toBe("Beginner");
  });
});

describe("buildHeatmap", () => {
  const wed = new Date(2026, 8, 23); // Wed Sep 23 2026
  it("is 12 week columns of 7, with days after today empty", () => {
    const g = buildHeatmap([], wed);
    expect(g).toHaveLength(12);
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g[11]).toEqual([0, 0, 0, 0, null, null, null]); // Sun..Wed then future
  });
  it("counts visits on the right day and ignores older ones", () => {
    const g = buildHeatmap(["2026-09-23", "2026-09-23", "2026-09-20", "2020-01-01"], wed);
    expect(g[11][3]).toBe(2);
    expect(g[11][0]).toBe(1);
    expect(g.flat().reduce<number>((s, c) => s + (c ?? 0), 0)).toBe(3);
  });
  it("starts the query on the first Sunday shown", () => {
    expect(heatmapSince(wed)).toBe("2026-07-05");
    expect(buildHeatmap(["2026-07-05"], wed)[0][0]).toBe(1);
  });
});

describe("heatLevel", () => {
  it("buckets counts", () => {
    expect([0, 1, 2, 3, 9].map(heatLevel)).toEqual([0, 1, 2, 3, 3]);
  });
});
