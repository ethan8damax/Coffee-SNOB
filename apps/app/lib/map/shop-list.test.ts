import { describe, it, expect } from "vitest";
import { applyFilter, buildRows, distanceKm, dropRatedDuplicates, formatDistance, MAP_FILTERS, MAX_ROWS, rowSubtitle, withPinned } from "./shop-list";
import type { NearbyShopPin, RatedShopPin } from "../../components/map/types";

const rated = (id: string, rating: number, lat: number, lng: number, extra: Partial<RatedShopPin> = {}): RatedShopPin => ({
  id, name: `Rated ${id}`, lat, lng, neighborhood: null, isSnobApproved: false, tag: null, priceTier: null, rating, logCount: 1, externalId: null, ...extra,
});
const nearby = (externalId: string, lat: number, lng: number, extra: Partial<NearbyShopPin> = {}): NearbyShopPin => ({
  externalId, name: `Nearby ${externalId}`, lat, lng, address: null, hours: null, website: null, phone: null, ...extra,
});

describe("distanceKm", () => {
  it("is 0 for the same point", () => {
    expect(distanceKm({ lat: 33.75, lng: -84.39 }, { lat: 33.75, lng: -84.39 })).toBe(0);
  });
  it("is about 111 km per degree of latitude", () => {
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.19, 1);
  });
});

describe("formatDistance", () => {
  it("shows miles with one decimal under 10", () => {
    expect(formatDistance(1)).toBe("0.6 mi");
    expect(formatDistance(3.4)).toBe("2.1 mi");
  });
  it("floors tiny distances and rounds long ones", () => {
    expect(formatDistance(0.05)).toBe("<0.1 mi");
    expect(formatDistance(40)).toBe("25 mi");
  });
});

describe("applyFilter", () => {
  const r = [rated("a", 5, 0, 0), rated("b", 3, 0, 0), rated("c", 4, 0, 0)];
  const n = [nearby("x", 0, 0)];
  it("all keeps everything", () => {
    expect(applyFilter("all", r, n)).toEqual({ rated: r, nearby: n });
  });
  it("rated drops the unrated dots", () => {
    expect(applyFilter("rated", r, n)).toEqual({ rated: r, nearby: [] });
  });
  it("top keeps only 4s and 5s and drops the dots", () => {
    expect(applyFilter("top", r, n).rated.map((s) => s.id)).toEqual(["a", "c"]);
    expect(applyFilter("top", r, n).nearby).toEqual([]);
  });
  it("exposes the design's chip labels", () => {
    expect(MAP_FILTERS.map((f) => f.label)).toEqual(["All", "Rated", "Make the trip +"]);
  });
});

describe("buildRows", () => {
  const origin = { lat: 0, lng: 0 };
  it("lists rated shops first (best verdict, then nearest), then unrated by distance", () => {
    const rows = buildRows(
      [rated("far5", 5, 0, 0.2), rated("near4", 4, 0, 0.01), rated("near5", 5, 0, 0.05)],
      [nearby("far", 0, 0.3), nearby("near", 0, 0.02)],
      origin,
    );
    expect(rows.map((r) => (r.kind === "rated" ? r.shop.id : r.shop.externalId))).toEqual(["near5", "far5", "near4", "near", "far"]);
  });
  it("attaches distances, or null when there is no origin", () => {
    expect(buildRows([rated("a", 4, 0, 0.1)], [], origin)[0].distanceKm).toBeGreaterThan(0);
    expect(buildRows([rated("a", 4, 0, 0.1)], [], null)[0].distanceKm).toBeNull();
  });
  it("orders unrated shops by name when there is no origin", () => {
    const rows = buildRows([], [nearby("2", 0, 0, { name: "Zed" }), nearby("1", 0, 0, { name: "Alpha" })], null);
    expect(rows.map((r) => r.shop.name)).toEqual(["Alpha", "Zed"]);
  });
  it("caps the list at MAX_ROWS, zoomed way out over a whole region", () => {
    const manyNearby = Array.from({ length: 300 }, (_, i) => nearby(String(i), 0, i * 0.001));
    const rows = buildRows([], manyNearby, origin);
    expect(rows).toHaveLength(MAX_ROWS);
  });
  it("keeps the top-rated shops when the cap would otherwise cut them, even outnumbered by unrated dots", () => {
    const manyRated = Array.from({ length: 5 }, (_, i) => rated(`r${i}`, 5, 0, i * 0.001));
    const manyNearby = Array.from({ length: 300 }, (_, i) => nearby(String(i), 0, i * 0.001));
    const rows = buildRows(manyRated, manyNearby, origin);
    expect(rows.slice(0, 5).every((r) => r.kind === "rated")).toBe(true);
    expect(rows).toHaveLength(MAX_ROWS);
  });
});

describe("dropRatedDuplicates", () => {
  it("drops unrated dots that are already rated pins", () => {
    const rated = [{ externalId: "way/1" }, { externalId: null }];
    const dots = [nearby("way/1", 0, 0), nearby("node/2", 0, 0)];
    expect(dropRatedDuplicates(dots, rated).map((d) => d.externalId)).toEqual(["node/2"]);
  });
});

describe("withPinned", () => {
  it("adds the searched shop until the area's own data includes it", () => {
    const pinned = nearby("node/9", 1, 1);
    expect(withPinned([nearby("node/1", 0, 0)], pinned).map((s) => s.externalId)).toEqual(["node/1", "node/9"]);
    expect(withPinned([nearby("node/9", 1, 1)], pinned).map((s) => s.externalId)).toEqual(["node/9"]);
    expect(withPinned([nearby("node/1", 0, 0)], null).map((s) => s.externalId)).toEqual(["node/1"]);
  });
});

describe("rowSubtitle", () => {
  it("joins neighborhood and tag for rated shops", () => {
    const [row] = buildRows([rated("a", 4, 0, 0, { neighborhood: "Bushwick", tag: "Roaster" })], [], null);
    expect(rowSubtitle(row)).toBe("Bushwick · Roaster");
  });
  it("falls back to a plain line when a rated shop has neither", () => {
    const [row] = buildRows([rated("a", 4, 0, 0)], [], null);
    expect(rowSubtitle(row)).toBe("Logged by the community");
  });
  it("uses the address for unrated shops, else says so", () => {
    const [withAddress] = buildRows([], [nearby("1", 0, 0, { address: "12 Main St" })], null);
    expect(rowSubtitle(withAddress)).toBe("12 Main St");
    const [without] = buildRows([], [nearby("2", 0, 0)], null);
    expect(rowSubtitle(without)).toBe("Not yet rated");
  });
});
