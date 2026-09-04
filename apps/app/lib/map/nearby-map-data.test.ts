import { describe, it, expect, vi } from "vitest";
import { fetchNearbyOsmShops, toRatedShopPin } from "./nearby-map-data";

describe("fetchNearbyOsmShops", () => {
  it("fetches from the given web app's proxy with the bounds as query params", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ shops: [{ externalId: "node/1", name: "Corner Cafe" }] }) })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const shops = await fetchNearbyOsmShops({ minLat: 1, minLng: 2, maxLat: 3, maxLng: 4 }, "https://example.com");

    expect(shops).toEqual([{ externalId: "node/1", name: "Corner Cafe" }]);
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/api/nearby-shops?minLat=1&minLng=2&maxLat=3&maxLng=4");
    vi.unstubAllGlobals();
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 502 })));
    await expect(fetchNearbyOsmShops({ minLat: 1, minLng: 2, maxLat: 3, maxLng: 4 }, "https://example.com")).rejects.toThrow(
      "nearby-shops request failed: 502"
    );
    vi.unstubAllGlobals();
  });
});

describe("toRatedShopPin", () => {
  it("maps a shop_ratings row to camelCase", () => {
    const pin = toRatedShopPin({
      id: "s1", name: "Noi Coffee", lat: 38.7, lng: -9.1, neighborhood: "Príncipe Real",
      is_snob_approved: true, tag: "Espresso bar", price_tier: "€€", rating: 5, log_count: 12,
    });
    expect(pin).toEqual({
      id: "s1", name: "Noi Coffee", lat: 38.7, lng: -9.1, neighborhood: "Príncipe Real",
      isSnobApproved: true, tag: "Espresso bar", priceTier: "€€", rating: 5, logCount: 12,
    });
  });
});
