import { describe, it, expect } from "vitest";
import { colors } from "@coffeesnob/design-tokens";
import { chipStyleForVariant } from "./chip-style";

describe("chipStyleForVariant", () => {
  it("default is an outlined chip with ink-2 text", () => {
    expect(chipStyleForVariant("default")).toEqual({ background: "transparent", text: colors.ink2, border: colors.rule });
  });
  it("on is ink-filled with paper text", () => {
    expect(chipStyleForVariant("on")).toEqual({ background: colors.ink, text: colors.paper, border: colors.ink });
  });
  it("ox is oxblood-filled with cream text", () => {
    expect(chipStyleForVariant("ox")).toEqual({ background: colors.oxblood, text: colors.cream, border: colors.oxblood });
  });
  it("bu is burnt-filled with ink text", () => {
    expect(chipStyleForVariant("bu")).toEqual({ background: colors.burnt, text: colors.ink, border: colors.burnt });
  });
});
