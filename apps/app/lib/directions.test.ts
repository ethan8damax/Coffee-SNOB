import { describe, it, expect } from "vitest";
import { directionsUrl } from "./directions";

describe("directionsUrl", () => {
  it("builds a universal Google Maps directions URL", () => {
    expect(directionsUrl(38.71, -9.14)).toBe("https://www.google.com/maps/dir/?api=1&destination=38.71,-9.14");
  });
});
