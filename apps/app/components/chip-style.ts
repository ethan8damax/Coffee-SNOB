import { colors } from "@coffeesnob/design-tokens";

export type ChipVariant = "default" | "on" | "ox" | "bu";
export type ChipStyle = { background: string; text: string; border: string };

// Mirrors `.chip`, `.chip.on`, `.chip.ox`, `.chip.bu` in the design's styles.css.
export function chipStyleForVariant(variant: ChipVariant): ChipStyle {
  switch (variant) {
    case "on":
      return { background: colors.ink, text: colors.paper, border: colors.ink };
    case "ox":
      return { background: colors.oxblood, text: colors.cream, border: colors.oxblood };
    case "bu":
      return { background: colors.burnt, text: colors.ink, border: colors.burnt };
    default:
      return { background: "transparent", text: colors.ink2, border: colors.rule };
  }
}
