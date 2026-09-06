import { describe, it, expect } from "vitest";
import { colors } from "@coffeesnob/design-tokens";
import { detourStyleForValue, DETOUR_LABELS } from "./detour-style";

describe("detourStyleForValue", () => {
  it("uses oxblood-on-cream for a 5", () => {
    expect(detourStyleForValue(5)).toEqual({ background: colors.oxblood, chevron: colors.cream, text: colors.cream, border: colors.oxblood });
  });

  it("uses burnt-on-ink for a 4", () => {
    expect(detourStyleForValue(4)).toEqual({ background: colors.burnt, chevron: colors.ink, text: colors.ink, border: colors.burnt });
  });

  it("uses an outlined/muted style for 1-3", () => {
    expect(detourStyleForValue(3)).toEqual({ background: "transparent", chevron: colors.burnt, text: colors.ink, border: colors.ink3 });
    expect(detourStyleForValue(1)).toEqual({ background: "transparent", chevron: colors.burnt, text: colors.ink3, border: colors.ink3 });
  });

  it("clamps out-of-range values into 1-5", () => {
    expect(detourStyleForValue(9)).toEqual(detourStyleForValue(5));
    expect(detourStyleForValue(0)).toEqual(detourStyleForValue(1));
  });
});

describe("DETOUR_LABELS", () => {
  it("has one label per rating, matching the marketing site's copy", () => {
    expect(DETOUR_LABELS).toEqual(["Stay home", "On your way", "Worth the detour", "Make the trip", "Catch a flight"]);
  });
});
