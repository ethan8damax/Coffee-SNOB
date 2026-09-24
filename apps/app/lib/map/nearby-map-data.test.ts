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
      is_snob_approved: true, tag: "Espresso bar", price_tier: "€€", rating: 5, log_count: 12, external_id: null,
    });
    expect(pin).toEqual({
      id: "s1", name: "Noi Coffee", lat: 38.7, lng: -9.1, neighborhood: "Príncipe Real",
      isSnobApproved: true, tag: "Espresso bar", priceTier: "€€", rating: 5, logCount: 12, externalId: null,
    });
  });

  it("is not meant to be called on a row with a null rating — callers must filter those out first", () => {
    // A Snob-Approved shop with no editorial_rating and no community logs
    // yet has rating = null (shop_ratings view). useNearbyMapData filters
    // these out before mapping (see nearby-map-data.ts), since there's no
    // valid tiered pin to render. This test documents that composition:
    // filter-then-map should drop null-rating rows before they ever reach
    // toRatedShopPin.
    const rows = [
      { id: "s1", name: "Approved, unrated", lat: 38.7, lng: -9.1, neighborhood: null, is_snob_approved: true, tag: null, price_tier: null, rating: null, log_count: 0, external_id: null },
      { id: "s2", name: "Rated", lat: 38.71, lng: -9.14, neighborhood: null, is_snob_approved: false, tag: null, price_tier: null, rating: 4, log_count: 3, external_id: null },
    ];
    const pins = rows.filter((r) => r.rating != null).map(toRatedShopPin);
    expect(pins).toHaveLength(1);
    expect(pins[0].id).toBe("s2");
  });

  it("carries the OSM external id so the duplicate dot can be dropped", () => {
    const pin = toRatedShopPin({
      id: "s1", name: "Muchacho", lat: 33.75, lng: -84.36, neighborhood: null, is_snob_approved: false,
      tag: null, price_tier: null, rating: 5, log_count: 1, external_id: "way/271015925",
    });
    expect(pin.externalId).toBe("way/271015925");
  });
});
