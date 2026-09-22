import { describe, it, expect } from "vitest";
import { TIERS, snobStatus } from "../src/profile-status";

describe("snobStatus", () => {
  it("names every tier at its exact threshold", () => {
    for (const tier of TIERS) {
      expect(snobStatus(tier.from).name).toBe(tier.name);
    }
  });

  it("reports the next tier and how many logs are needed", () => {
    expect(snobStatus(3).next).toEqual({ name: "Regular", needed: 2 });
  });

  it("has no next tier at the top", () => {
    expect(snobStatus(60).next).toBeNull();
    expect(snobStatus(1000).name).toBe("Head Snob");
  });

  it("clamps negative or non-finite counts to Beginner", () => {
    expect(snobStatus(-5).name).toBe("Beginner");
    expect(snobStatus(NaN).name).toBe("Beginner");
  });
});
