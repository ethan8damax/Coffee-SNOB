import { DETOUR_LABELS } from "../../components/detour-style";

export type VerdictFill = "outline" | "burnt" | "oxblood";
export type VerdictCopy = { value: number; word: string; sub: string; fill: VerdictFill };

// ponytail: sub-copy is written in brand voice, not copied from the design's
// DETOUR_SUB (design source was unreachable when this was built). Swap strings
// here if the design's wording differs.
const SUBS = [
  "Not worth leaving the house for.",
  "Fine if you're already nearby.",
  "Go a little out of your way.",
  "Plan part of your day around it.",
  "Book the ticket. It's that good.",
];

const FILLS: VerdictFill[] = ["outline", "outline", "outline", "burnt", "oxblood"];

export const VERDICTS: VerdictCopy[] = DETOUR_LABELS.map((word, i) => ({
  value: i + 1,
  word,
  sub: SUBS[i],
  fill: FILLS[i],
}));

export function verdictCopy(n: number): VerdictCopy {
  const v = Math.max(1, Math.min(5, Math.round(n)));
  return VERDICTS[v - 1];
}

export const VERDICT_FOOTNOTE = "Sets your verdict for this shop. Your entry is public.";

export const DRINKS = ["Espresso", "Cortado", "Flat white", "V60", "Aeropress", "Batch", "Decaf", "Iced"] as const;
