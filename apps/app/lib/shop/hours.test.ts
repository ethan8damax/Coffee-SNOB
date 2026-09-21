import { describe, it, expect } from "vitest";
import { hoursLines } from "./hours";

describe("hoursLines", () => {
  it("splits on ; and trims", () => {
    expect(hoursLines("Mo-Fr 07:30-18:00; Sa,Su 09:00-17:00")).toEqual(["Mo-Fr 07:30-18:00", "Sa,Su 09:00-17:00"]);
  });
  it("drops empty segments", () => {
    expect(hoursLines(" Mo-Fr 8-5 ;; ; ")).toEqual(["Mo-Fr 8-5"]);
  });
  it("null/blank -> empty", () => {
    expect(hoursLines(null)).toEqual([]);
    expect(hoursLines("  ")).toEqual([]);
  });
});
