import { describe, it, expect } from "vitest";
import { abbreviateState, formatShopLocation } from "./geocode";

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
