import { describe, it, expect } from "vitest";
import { cityKey } from "../src/city";

describe("cityKey", () => {
  it("builds the same slug as the shops.city_key generated column", () => {
    expect(cityKey("Atlanta", "Georgia", "US")).toBe("atlanta-georgia-us");
    expect(cityKey("New York", "New York", "US")).toBe("new-york-new-york-us");
    expect(cityKey("St. Petersburg", "Florida", "us")).toBe("st-petersburg-florida-us");
    expect(cityKey("London", null, "GB")).toBe("london-gb");
    expect(cityKey("São Paulo", "São Paulo", "BR")).toBe("s-o-paulo-s-o-paulo-br");
  });

  it("is null without a locality", () => {
    expect(cityKey(null, "Georgia", "US")).toBeNull();
    expect(cityKey("  ", "Georgia", "US")).toBeNull();
    // A name with no Latin letters would slug to just the country — one page per country.
    expect(cityKey("東京", "東京都", "JP")).toBeNull();
  });
});
