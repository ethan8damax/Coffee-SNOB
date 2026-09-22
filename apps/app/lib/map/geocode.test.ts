import { describe, it, expect, vi } from "vitest";
import { geocodePlaces, reverseGeocode, searchNearbyShops } from "./geocode";

describe("geocodePlaces", () => {
  it("fetches from the given web app's proxy with the query as a param", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ places: [{ id: "1", primary: "Kennesaw", secondary: "GA, US", lat: 34, lng: -84.6 }] }) })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const places = await geocodePlaces("Kennesaw", "https://example.com");

    expect(places).toEqual([{ id: "1", primary: "Kennesaw", secondary: "GA, US", lat: 34, lng: -84.6 }]);
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/api/geocode?q=Kennesaw");
    vi.unstubAllGlobals();
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 502 })));
    await expect(geocodePlaces("x", "https://example.com")).rejects.toThrow("geocode request failed: 502");
    vi.unstubAllGlobals();
  });
});

describe("reverseGeocode", () => {
  it("fetches from the reverse-geocode proxy with lat/lng and returns the secondary line", async () => {
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ secondary: "Kennesaw, GA, US" }) }));
    vi.stubGlobal("fetch", fetchSpy);

    const secondary = await reverseGeocode(34.02, -84.61, "https://example.com");

    expect(secondary).toBe("Kennesaw, GA, US");
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/api/reverse-geocode?lat=34.02&lng=-84.61");
    vi.unstubAllGlobals();
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 502 })));
    await expect(reverseGeocode(1, 2, "https://example.com")).rejects.toThrow("reverse-geocode request failed: 502");
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
