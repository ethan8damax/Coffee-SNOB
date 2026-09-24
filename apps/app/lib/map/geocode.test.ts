import { describe, it, expect, vi } from "vitest";
import { searchEverywhere, searchNearbyShops } from "./geocode";

describe("searchEverywhere", () => {
  it("calls /api/search with the query and a rounded bias, and shapes shops as pins", async () => {
    const fetchSpy = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        places: [{ id: "R1", primary: "Atlanta", secondary: "GA, USA", lat: 33.7, lng: -84.4 }],
        shops: [{ externalId: "node/1", name: "Dancing Goats Coffee", secondary: "Atlanta, GA, USA", lat: 33.75, lng: -84.36 }],
      }),
    }));
    vi.stubGlobal("fetch", fetchSpy);
    const result = await searchEverywhere("dancing goats", { lat: 36.1627, lng: -86.7816 }, "https://example.com");
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/api/search?q=dancing+goats&lat=36.2&lng=-86.8");
    expect(result.places).toEqual([{ id: "R1", primary: "Atlanta", secondary: "GA, USA", lat: 33.7, lng: -84.4 }]);
    expect(result.shops).toEqual([{
      shop: { externalId: "node/1", name: "Dancing Goats Coffee", lat: 33.75, lng: -84.36, address: null, hours: null, website: null, phone: null },
      secondary: "Atlanta, GA, USA",
    }]);
    vi.unstubAllGlobals();
  });

  it("omits the bias without an origin, and throws on a failed response", async () => {
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ places: [], shops: [] }) }));
    vi.stubGlobal("fetch", fetchSpy);
    await searchEverywhere("atlanta", null, "https://example.com");
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/api/search?q=atlanta");
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 502 })));
    await expect(searchEverywhere("x y", null, "https://example.com")).rejects.toThrow("search request failed: 502");
    vi.unstubAllGlobals();
  });
});

describe("searchNearbyShops", () => {
  it("fetches nearby-shops with a box around the origin, the query, and returns the shops", async () => {
    const fetchSpy = vi.fn((_url: string) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ shops: [{ externalId: "way/1", name: "Muchacho", lat: 33.75, lng: -84.36, address: null, hours: null, website: null, phone: null }] }) })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const shops = await searchNearbyShops("Muchacho", { lat: 34.08, lng: -84.29 }, "https://example.com");

    expect(shops).toEqual([{ externalId: "way/1", name: "Muchacho", lat: 33.75, lng: -84.36, address: null, hours: null, website: null, phone: null }]);
    const calledUrl = fetchSpy.mock.calls[0][0];
    expect(calledUrl).toContain("https://example.com/api/nearby-shops?");
    expect(calledUrl).toContain("q=Muchacho");
    expect(calledUrl).toContain("minLat=33.08");
    expect(calledUrl).toContain("maxLat=35.08");
    vi.unstubAllGlobals();
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 502 })));
    await expect(searchNearbyShops("x", { lat: 0, lng: 0 }, "https://example.com")).rejects.toThrow("nearby-shops search failed: 502");
    vi.unstubAllGlobals();
  });
});
