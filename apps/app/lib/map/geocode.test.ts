import { describe, it, expect, vi } from "vitest";
import { geocodePlaces } from "./geocode";

describe("geocodePlaces", () => {
  it("fetches from the given web app's proxy with the query as a param", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ places: [{ id: "1", name: "Kennesaw", displayName: "Kennesaw, GA", lat: 34, lng: -84.6 }] }) })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const places = await geocodePlaces("Kennesaw", "https://example.com");

    expect(places).toEqual([{ id: "1", name: "Kennesaw", displayName: "Kennesaw, GA", lat: 34, lng: -84.6 }]);
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/api/geocode?q=Kennesaw");
    vi.unstubAllGlobals();
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 502 })));
    await expect(geocodePlaces("x", "https://example.com")).rejects.toThrow("geocode request failed: 502");
    vi.unstubAllGlobals();
  });
});
