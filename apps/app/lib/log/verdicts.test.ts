import { describe, it, expect } from "vitest";
import { verdictCopy, VERDICTS } from "./verdicts";

describe("verdictCopy", () => {
  it("maps 1..5 to the detour words", () => {
    expect(verdictCopy(1).word).toBe("Stay home");
    expect(verdictCopy(5).word).toBe("Catch a flight");
    expect(VERDICTS).toHaveLength(5);
  });
  it("fills: outline 1-3, burnt 4, oxblood 5", () => {
    expect([1, 2, 3].map((n) => verdictCopy(n).fill)).toEqual(["outline", "outline", "outline"]);
    expect(verdictCopy(4).fill).toBe("burnt");
    expect(verdictCopy(5).fill).toBe("oxblood");
  });
  it("clamps out-of-range values", () => {
    expect(verdictCopy(0).value).toBe(1);
    expect(verdictCopy(9).value).toBe(5);
  });
});
