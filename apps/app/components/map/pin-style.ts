import { colors } from "@coffeesnob/design-tokens";

// Mirrors the Claude Design mockup's map screen (screens/map.jsx `tier()`):
// 5 -> oxblood, 4 -> burnt, 1-3 -> outlined/muted.
export type PinStyle = { background: string; foreground: string; border: string };

export function pinStyleForRating(rating: number): PinStyle {
  if (rating >= 5) return { background: colors.oxblood, foreground: colors.cream, border: colors.oxblood };
  if (rating === 4) return { background: colors.burnt, foreground: colors.ink, border: colors.burnt };
  return { background: colors.card, foreground: colors.ink2, border: colors.rule };
}
