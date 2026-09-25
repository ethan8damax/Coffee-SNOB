import { describe, it, expect } from "vitest";
import { toSearchHit, toLocality, type PhotonFeature } from "./photon";

const feature = (properties: PhotonFeature["properties"], lon = -84.36, lat = 33.75): PhotonFeature => ({
  geometry: { coordinates: [lon, lat] },
  properties,
});
const chains = [{ name: "starbucks", wikidata: "Q37158" }];

describe("toSearchHit", () => {
  it("maps a café to a shop hit with our external id and a City, ST, USA line", () => {
    const hit = toSearchHit(
      feature({ osm_type: "N", osm_id: 12348556801, osm_key: "amenity", osm_value: "cafe", name: "Dancing Goats Coffee", city: "Atlanta", state: "Georgia", countrycode: "US" }),
      chains,
    );
    expect(hit).toEqual({ kind: "shop", externalId: "node/12348556801", name: "Dancing Goats Coffee", secondary: "Atlanta, GA, USA", lat: 33.75, lng: -84.36 });
  });

  it("maps ways and relations to way/ and relation/ ids", () => {
    const hit = toSearchHit(feature({ osm_type: "W", osm_id: 51305933, osm_key: "amenity", osm_value: "cafe", name: "Dancing Goats Coffee Bar", city: "Decatur", state: "Georgia", countrycode: "US" }), chains);
    expect(hit && hit.kind === "shop" && hit.externalId).toBe("way/51305933");
  });

  it("maps a city to a place hit headlined by its name", () => {
    const hit = toSearchHit(feature({ osm_type: "R", osm_id: 119557, osm_key: "place", osm_value: "city", name: "Atlanta", state: "Georgia", countrycode: "US" }), chains);
    expect(hit).toEqual({ kind: "place", place: { id: "R119557", primary: "Atlanta", secondary: "GA, USA", lat: 33.75, lng: -84.36, cityKey: "atlanta-georgia-us" } });
  });

  it("gives states just the country and countries nothing", () => {
    const state = toSearchHit(feature({ osm_type: "R", osm_id: 1, osm_key: "place", osm_value: "state", name: "Georgia", state: "Georgia", countrycode: "US" }), chains);
    const country = toSearchHit(feature({ osm_type: "R", osm_id: 2, osm_key: "place", osm_value: "country", name: "Portugal", countrycode: "PT" }), chains);
    expect(state && state.kind === "place" && state.place.secondary).toBe("USA");
    expect(country && country.kind === "place" && country.place.secondary).toBe("");
    // Only city-level places can have a city page.
    expect(state && state.kind === "place" && state.place.cityKey).toBeNull();
    expect(country && country.kind === "place" && country.place.cityKey).toBeNull();
  });

  it("drops chains, non-coffee cafés, stray place types, and anything unnamed", () => {
    expect(toSearchHit(feature({ osm_type: "N", osm_id: 1, osm_key: "amenity", osm_value: "cafe", name: "Starbucks" }), chains)).toBeNull();
    expect(toSearchHit(feature({ osm_type: "N", osm_id: 2, osm_key: "amenity", osm_value: "cafe", name: "Kung Fu Tea" }), chains)).toBeNull();
    expect(toSearchHit(feature({ osm_type: "N", osm_id: 3, osm_key: "place", osm_value: "locality", name: "Blue Bottle Terrace" }), chains)).toBeNull();
    expect(toSearchHit(feature({ osm_type: "N", osm_id: 4, osm_key: "amenity", osm_value: "restaurant", name: "Muchacho" }), chains)).toBeNull();
    expect(toSearchHit(feature({ osm_type: "N", osm_id: 5, osm_key: "amenity", osm_value: "cafe" }), chains)).toBeNull();
  });

  it("matches chain names loosely, since Photon returns no brand IDs", () => {
    const withIds = [{ name: "dunkin", wikidata: "Q847743" }, { name: "costa coffee", wikidata: "Q608845" }];
    const cafe = (name: string) => feature({ osm_type: "N", osm_id: 9, osm_key: "amenity", osm_value: "cafe", name });
    expect(toSearchHit(cafe("Dunkin Donuts"), withIds)).toBeNull();
    expect(toSearchHit(cafe("Dunkin' Donuts"), withIds)).toBeNull();
    expect(toSearchHit(cafe("Costa Rica Café"), withIds)).not.toBeNull();
  });
});

describe("toLocality", () => {
  it("takes the city, state and country code", () => {
    expect(toLocality(feature({ osm_type: "W", osm_id: 1, osm_key: "amenity", osm_value: "restaurant", city: "Atlanta", state: "Georgia", countrycode: "US" })))
      .toEqual({ locality: "Atlanta", region: "Georgia", countryCode: "US" });
  });
  it("falls back to the county where there's no city, and to nulls with nothing", () => {
    expect(toLocality(feature({ osm_type: "W", osm_id: 2, osm_key: "highway", osm_value: "secondary", county: "Cobb", state: "Georgia", countrycode: "us" })))
      .toEqual({ locality: "Cobb", region: "Georgia", countryCode: "US" });
    expect(toLocality(undefined)).toEqual({ locality: null, region: null, countryCode: null });
  });
});
