import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchIndexShops, matchesQuery, searchCellsAround, tileKeysFor, toPin, type IndexManifest } from "./coffee-index";

const manifest: IndexManifest = { version: "v1", tileStep: 0.1, splitStep: 0.025, searchStep: 1, split: ["10.7_106.6"] };

describe("tileKeysFor", () => {
  it("lists the 0.1° cells covering a grid-snapped box, named like the build", () => {
    expect(tileKeysFor({ minLat: 33.7, minLng: -84.4, maxLat: 33.9, maxLng: -84.3 }, manifest)).toEqual({
      tiles: ["33.7_-84.4", "33.8_-84.4"],
      fine: [],
    });
  });

  it("swaps a split cell for the fine cells inside the box", () => {
    const { tiles, fine } = tileKeysFor({ minLat: 10.7, minLng: 106.6, maxLat: 10.75, maxLng: 106.625 }, manifest);
    expect(tiles).toEqual([]);
    expect(fine).toEqual(["10.7_106.6", "10.725_106.6"]);
  });
});

describe("searchCellsAround", () => {
  it("returns the 3×3 block of 1° cells around a point", () => {
    const cells = searchCellsAround({ lat: 33.75, lng: -84.39 }, 1);
    expect(cells).toHaveLength(9);
    expect(cells).toContain("33_-85");
    expect(cells).toContain("32_-86");
    expect(cells).toContain("34_-84");
  });
});

describe("matchesQuery", () => {
  it("needs every word, in any order, ignoring case, accents and punctuation", () => {
    expect(matchesQuery("East Pole Coffee Co.", "pole east")).toBe(true);
    expect(matchesQuery("Café Clément", "cafe clem")).toBe(true);
    expect(matchesQuery("Muchacho", "muchacho atlanta")).toBe(false);
  });
});

describe("toPin", () => {
  it("maps a tile entry to a map pin keyed by its cs_ id", () => {
    expect(
      toPin({
        id: "cs_1", sourceIds: ["ov:a", "osm:node/7"], name: "Perc", lat: 33.78, lng: -84.35, address: "1046 N Highland Ave NE",
        locality: "Atlanta", region: "GA", countryCode: "US", website: null, phone: null, hours: "Mo-Su 07:00-17:00",
        visibility: "dim", why: [],
      }),
    ).toEqual({
      externalId: "cs_1", sourceIds: ["ov:a", "osm:node/7"], name: "Perc", lat: 33.78, lng: -84.35,
      address: "1046 N Highland Ave NE", hours: "Mo-Su 07:00-17:00", website: null, phone: null, visibility: "dim",
    });
  });
});

describe("fetchIndexShops", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the manifests, then the tiles, treating a missing tile as an empty cell", async () => {
    const files: Record<string, unknown> = {
      "https://idx.test/manifest.json": { version: "v1" },
      "https://idx.test/v/v1/manifest.json": manifest,
      "https://idx.test/v/v1/tiles/33.7_-84.4.json": [{ id: "cs_1", name: "Perc", lat: 33.78, lng: -84.35, sourceIds: [], visibility: "show" }],
    };
    const fetchSpy = vi.fn((url: string) =>
      Promise.resolve(url in files ? { ok: true, status: 200, json: () => Promise.resolve(files[url]) } : { ok: false, status: 404 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const shops = await fetchIndexShops({ minLat: 33.7, minLng: -84.4, maxLat: 33.9, maxLng: -84.3 }, "https://idx.test");
    expect(shops.map((s) => s.externalId)).toEqual(["cs_1"]);
    expect(fetchSpy).toHaveBeenCalledWith("https://idx.test/v/v1/tiles/33.8_-84.4.json");
  });
});
