import { colors } from "@coffeesnob/design-tokens";

export const DETOUR_LABELS = ["Stay home", "On your way", "Worth the detour", "Make the trip", "Catch a flight"];

export type DetourStyle = { background: string; chevron: string; text: string; border: string };

// Mirrors the marketing site's Detour chip (apps/web/components/primitives.tsx)
// and the map's pin tiering (components/map/pin-style.ts): 5 -> oxblood,
// 4 -> burnt, 1-3 -> outlined/muted, with 1 dimmed further.
export function detourStyleForValue(value: number): DetourStyle {
  const v = Math.max(1, Math.min(5, Math.round(value)));
  if (v === 5) return { background: colors.oxblood, chevron: colors.cream, text: colors.cream, border: colors.oxblood };
  if (v === 4) return { background: colors.burnt, chevron: colors.ink, text: colors.ink, border: colors.burnt };
  return { background: "transparent", chevron: colors.burnt, text: v === 1 ? colors.ink3 : colors.ink, border: colors.ink3 };
}
