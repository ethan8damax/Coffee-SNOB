import { describe, expect, it } from "vitest";
import { topFourSlots } from "./top4";

describe("topFourSlots", () => {
  const picks = [{ slot: 3, shopId: "c", name: "C" }, { slot: 1, shopId: "a", name: "A" }];
  it("lays out four slots for the owner, empty ones as null", () => {
    expect(topFourSlots(picks, true).map((s) => s.pick?.shopId ?? null)).toEqual(["a", null, "c", null]);
  });
  it("shows visitors only the filled slots, in slot order", () => {
    expect(topFourSlots(picks, false).map((s) => s.slot)).toEqual([1, 3]);
  });
});
