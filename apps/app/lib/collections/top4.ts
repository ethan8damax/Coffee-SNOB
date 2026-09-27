import type { TopShop } from "@coffeesnob/supabase";

export type Slot = { slot: number; pick: TopShop | null };

// Four fixed slots, Letterboxd-style. Owners see the empty ones (to fill);
// visitors see only what's been picked.
export function topFourSlots(picks: TopShop[], isOwn: boolean): Slot[] {
  const all = [1, 2, 3, 4].map((slot) => ({ slot, pick: picks.find((p) => p.slot === slot) ?? null }));
  return isOwn ? all : all.filter((s) => s.pick);
}
