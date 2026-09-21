import { describe, it, expect } from "vitest";
import { colors } from "@coffeesnob/design-tokens";
import { pinStyleForRating } from "./pin-style";

describe("pinStyleForRating", () => {
  it("uses oxblood for a 5", () => {
    expect(pinStyleForRating(5)).toEqual({ background: colors.oxblood, foreground: colors.cream, border: colors.oxblood });
  });

  it("uses burnt for a 4", () => {
    expect(pinStyleForRating(4)).toEqual({ background: colors.burnt, foreground: colors.ink, border: colors.burnt });
  });

  it("uses an outlined/muted style for 1-3", () => {
    expect(pinStyleForRating(3)).toEqual({ background: colors.card, foreground: colors.ink2, border: "rgba(22,19,16,.32)" });
    expect(pinStyleForRating(1)).toEqual({ background: colors.card, foreground: colors.ink2, border: "rgba(22,19,16,.32)" });
  });
});
