// Snob status is derived from how many visits someone has logged — no stored tier to drift
// out of sync. Lives in @coffeesnob/supabase so apps/web's admin dashboard can show it too;
// re-exported here so existing imports of "./status" in this app don't change.
export { TIERS, snobStatus } from "@coffeesnob/supabase";

const DAY_MS = 86_400_000;
const toDay = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
const parseDay = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
};

export const HEATMAP_WEEKS = 12;

// Visits per day for the last `weeks` weeks, oldest first, grouped into week columns of 7
// (Sun..Sat, ending with the week that contains `today`; days after today are null).
export function buildHeatmap(visitedAt: string[], today: Date, weeks = HEATMAP_WEEKS): (number | null)[][] {
  const counts = new Map<number, number>();
  for (const iso of visitedAt) counts.set(parseDay(iso), (counts.get(parseDay(iso)) ?? 0) + 1);
  const todayDay = toDay(today);
  const weekStart = todayDay - today.getDay() - (weeks - 1) * 7;
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = weekStart + w * 7 + d;
      return day > todayDay ? null : (counts.get(day) ?? 0);
    })
  );
}

// 0 = none, 1..3 = light..dark.
export function heatLevel(count: number): 0 | 1 | 2 | 3 {
  return count <= 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3;
}

// ISO date of the first day the heatmap shows, for the "since" query.
export function heatmapSince(today: Date, weeks = HEATMAP_WEEKS): string {
  const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - (today.getDay() + (weeks - 1) * 7) * DAY_MS);
  return d.toISOString().slice(0, 10);
}
