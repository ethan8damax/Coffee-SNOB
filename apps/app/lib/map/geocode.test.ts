import { describe, it, expect, vi } from "vitest";
import { geocodePlaces, reverseGeocode } from "./geocode";

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
