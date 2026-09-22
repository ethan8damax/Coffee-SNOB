import { describe, it, expect } from "vitest";
import { toPlace } from "./geocode";

describe("toPlace", () => {
  it("prefers the short name, falling back to the first part of the full address", () => {
    expect(toPlace({ place_id: 1, display_name: "Smyrna, Cobb County, Georgia, United States", lat: "33.88", lon: "-84.51" })).toEqual({
      id: "1",
      name: "Smyrna",
      displayName: "Smyrna, Cobb County, Georgia, United States",
      lat: 33.88,
      lng: -84.51,
    });
  });
  it("uses Nominatim's own name field when present", () => {
    const place = toPlace({ place_id: 2, display_name: "Kennesaw, Cobb County, Georgia", lat: "34.02", lon: "-84.62", name: "Kennesaw" });
    expect(place?.name).toBe("Kennesaw");
  });
  it("drops a result with a non-numeric lat/lng", () => {
    expect(toPlace({ place_id: 3, display_name: "Nowhere", lat: "abc", lon: "-84.5" })).toBeNull();
  });
});
