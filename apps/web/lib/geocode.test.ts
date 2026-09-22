import { describe, it, expect } from "vitest";
import { abbreviateState, formatAddress, formatShopLocation, toPlace } from "./geocode";

describe("abbreviateState", () => {
  it("abbreviates a known US state", () => {
    expect(abbreviateState("Georgia", "us")).toBe("GA");
  });
  it("leaves non-US states as-is", () => {
    expect(abbreviateState("Bavaria", "de")).toBe("Bavaria");
  });
  it("leaves an unrecognized US 'state' name as-is", () => {
    expect(abbreviateState("Somewhere", "us")).toBe("Somewhere");
  });
});

describe("formatAddress", () => {
  it("headlines the city, trailing state + country when there's a city match", () => {
    expect(formatAddress({ city: "Kennesaw", state: "Georgia", country: "United States", country_code: "us" })).toEqual({
      primary: "Kennesaw",
      secondary: "GA, USA",
    });
  });
  it("falls back through town/village/hamlet for the city field", () => {
    expect(formatAddress({ village: "Lazy", country_code: "us" })?.primary).toBe("Lazy");
  });
  it("drops the state when the match has none (some countries have no admin state level)", () => {
    expect(formatAddress({ city: "Paris", country: "France", country_code: "fr" })).toEqual({ primary: "Paris", secondary: "FR" });
  });
  it("abbreviates the US as USA, not the bare ISO code", () => {
    expect(formatAddress({ city: "Kennesaw", country_code: "us" })).toEqual({ primary: "Kennesaw", secondary: "USA" });
  });
  it("headlines the state when there's no city match", () => {
    expect(formatAddress({ state: "Georgia", country: "United States", country_code: "us" })).toEqual({ primary: "Georgia", secondary: "USA" });
  });
  it("headlines just the country when that's the only match", () => {
    expect(formatAddress({ country: "United States", country_code: "us" })).toEqual({ primary: "United States", secondary: "" });
  });
  it("is null when there's nothing usable in the address", () => {
    expect(formatAddress({})).toBeNull();
    expect(formatAddress(undefined)).toBeNull();
  });
});

describe("formatShopLocation", () => {
  it("joins city, state abbreviation and country abbreviation", () => {
    expect(formatShopLocation({ city: "Kennesaw", state: "Georgia", country_code: "us" })).toBe("Kennesaw, GA, USA");
  });
  it("skips missing parts rather than leaving stray commas", () => {
    expect(formatShopLocation({ city: "Paris", country_code: "fr" })).toBe("Paris, FR");
  });
  it("is empty for an address with nothing usable", () => {
    expect(formatShopLocation(undefined)).toBe("");
  });
});

describe("toPlace", () => {
  it("builds a place from a Nominatim result with addressdetails", () => {
    expect(
      toPlace({ place_id: 1, lat: "34.02", lon: "-84.61", address: { city: "Kennesaw", state: "Georgia", country_code: "us" } })
    ).toEqual({ id: "1", primary: "Kennesaw", secondary: "GA, USA", lat: 34.02, lng: -84.61 });
  });
  it("drops a result with a non-numeric lat/lng", () => {
    expect(toPlace({ place_id: 2, lat: "abc", lon: "-84.5", address: { country: "X" } })).toBeNull();
  });
  it("drops a result with no usable address", () => {
    expect(toPlace({ place_id: 3, lat: "1", lon: "2", address: {} })).toBeNull();
  });
});
