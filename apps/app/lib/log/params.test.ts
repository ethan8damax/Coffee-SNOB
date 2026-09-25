import { describe, it, expect } from "vitest";
import { parseLogParams, normalizeNote, buildLogVisitInput, canPublish, NOTE_MAX } from "./params";

describe("parseLogParams", () => {
  it("existing shop", () => {
    expect(parseLogParams({ shopId: "abc" })).toEqual({ kind: "existing", shopId: "abc" });
  });
  it("existing wins over osm params", () => {
    expect(parseLogParams({ shopId: "abc", externalId: "node/1", name: "X", lat: "1", lng: "2" }).kind).toBe("existing");
  });
  it("osm shop with optionals", () => {
    expect(
      parseLogParams({ externalId: "node/1", name: "Cafe", lat: "40.7", lng: "-74", address: "1 Main", hours: "Mo-Fr 8-5" }),
    ).toEqual({
      kind: "osm",
      externalId: "node/1",
      name: "Cafe",
      lat: 40.7,
      lng: -74,
      address: "1 Main",
      website: null,
      phone: null,
      hours: "Mo-Fr 8-5",
    });
  });
  it("carries a coffee index place's legacy OSM ids through to the log input", () => {
    const p = parseLogParams({ externalId: "cs_1", name: "Perc", lat: "1", lng: "2", legacyIds: "node/7,way/8" });
    expect(p).toMatchObject({ kind: "osm", externalId: "cs_1", legacyIds: ["node/7", "way/8"] });
    expect(buildLogVisitInput(p, { rating: 4, drink: null, note: "" })).toMatchObject({ legacyIds: ["node/7", "way/8"] });
  });
  it("takes first of array params and ignores blanks", () => {
    expect(parseLogParams({ shopId: ["a", "b"] })).toEqual({ kind: "existing", shopId: "a" });
    expect(parseLogParams({ shopId: "  " })).toEqual({ kind: "none" });
  });
  it("none when osm params are incomplete or lat/lng not finite", () => {
    expect(parseLogParams({})).toEqual({ kind: "none" });
    expect(parseLogParams({ externalId: "node/1", name: "X", lat: "abc", lng: "2" })).toEqual({ kind: "none" });
    expect(parseLogParams({ externalId: "node/1", name: "X", lat: "", lng: "2" })).toEqual({ kind: "none" });
    expect(parseLogParams({ externalId: "node/1", name: "X", lat: "Infinity", lng: "2" })).toEqual({ kind: "none" });
    expect(parseLogParams({ externalId: "node/1", lat: "1", lng: "2" })).toEqual({ kind: "none" });
  });
});

describe("normalizeNote", () => {
  it("trims, empties to null, caps length", () => {
    expect(normalizeNote("  hi  ")).toBe("hi");
    expect(normalizeNote("   ")).toBeNull();
    expect(normalizeNote("a".repeat(NOTE_MAX + 20))).toHaveLength(NOTE_MAX);
  });
});

describe("buildLogVisitInput", () => {
  it("existing", () => {
    expect(buildLogVisitInput({ kind: "existing", shopId: "s1" }, { rating: 4, drink: "V60", note: " good " })).toEqual({
      kind: "existing",
      shopId: "s1",
      rating: 4,
      drink: "V60",
      note: "good",
    });
  });
  it("osm carries shop fields", () => {
    const p = parseLogParams({ externalId: "node/1", name: "Cafe", lat: "1", lng: "2" });
    expect(buildLogVisitInput(p, { rating: 2, drink: null, note: "" })).toEqual({
      kind: "osm",
      externalId: "node/1",
      name: "Cafe",
      lat: 1,
      lng: 2,
      address: null,
      website: null,
      phone: null,
      hours: null,
      rating: 2,
      drink: null,
      note: null,
    });
  });
  it("null for kind none or missing verdict", () => {
    expect(buildLogVisitInput({ kind: "none" }, { rating: 3, drink: null, note: "" })).toBeNull();
    expect(buildLogVisitInput({ kind: "existing", shopId: "s" }, { rating: null, drink: null, note: "" })).toBeNull();
  });
});

describe("canPublish", () => {
  it("needs a shop, a verdict and not submitting", () => {
    const p = { kind: "existing", shopId: "s" } as const;
    expect(canPublish(p, 3, false)).toBe(true);
    expect(canPublish(p, null, false)).toBe(false);
    expect(canPublish(p, 3, true)).toBe(false);
    expect(canPublish({ kind: "none" }, 3, false)).toBe(false);
  });
});
