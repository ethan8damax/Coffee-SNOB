import { describe, expect, it } from "vitest";
import { newShopId } from "./new-shop";

describe("newShopId", () => {
  it("makes a fresh user/<uuid> id every time", () => {
    const a = newShopId();
    expect(a).toMatch(/^user\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newShopId()).not.toBe(a);
  });
});
