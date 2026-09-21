import { describe, it, expect } from "vitest";
import { relativeDate, topVerdictWord, consensusLine, verdictCountLabel, telUrl, websiteUrl } from "./format";

const now = new Date("2026-09-21T12:00:00Z");

describe("relativeDate", () => {
  it("today / yesterday / days / weeks / months / years", () => {
    expect(relativeDate("2026-09-21T09:00:00Z", now)).toBe("Today");
    expect(relativeDate("2026-09-20T09:00:00Z", now)).toBe("Yesterday");
    expect(relativeDate("2026-09-16T09:00:00Z", now)).toBe("5 days ago");
    expect(relativeDate("2026-09-07T09:00:00Z", now)).toBe("2 weeks ago");
    expect(relativeDate("2026-06-21T09:00:00Z", now)).toBe("3 months ago");
    expect(relativeDate("2024-09-21T09:00:00Z", now)).toBe("2 years ago");
  });
  it("future or garbage", () => {
    expect(relativeDate("2026-10-01T00:00:00Z", now)).toBe("Today");
    expect(relativeDate("nope", now)).toBe("");
  });
});

describe("topVerdictWord", () => {
  it("uses the long detour words", () => {
    expect(topVerdictWord(3)).toBe("Worth the detour");
    expect(topVerdictWord(null)).toBeNull();
  });
});

describe("verdictCountLabel", () => {
  it("pluralises", () => {
    expect(verdictCountLabel(1)).toBe("Snob consensus · 1 verdict");
    expect(verdictCountLabel(12)).toBe("Snob consensus · 12 verdicts");
  });
});

describe("consensusLine", () => {
  it("null when no logs", () => {
    expect(consensusLine({ logCount: 0, topVerdict: null })).toBeNull();
  });
  // PRODUCT.md: the scale is the brand — verdict words only, never a numeric average.
  it("is just the verdict word when logged, with no numeric average", () => {
    expect(consensusLine({ logCount: 3, topVerdict: 4 })).toEqual({ word: "Make the trip" });
    expect(consensusLine({ logCount: 1, topVerdict: 2 })).toEqual({ word: "On your way" });
  });
});

describe("links", () => {
  it("telUrl keeps + and digits", () => {
    expect(telUrl("+1 (212) 555-0100")).toBe("tel:+12125550100");
  });
  it("websiteUrl adds https when scheme missing, rejects non-http", () => {
    expect(websiteUrl("example.com")).toBe("https://example.com");
    expect(websiteUrl("http://a.com")).toBe("http://a.com");
    expect(websiteUrl("javascript:alert(1)")).toBeNull();
  });
});
