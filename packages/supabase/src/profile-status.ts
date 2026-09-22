// Snob status is derived from how many visits someone has logged — no stored tier to drift out of sync.
export const TIERS = [
  { name: "Beginner", from: 0 },
  { name: "Regular", from: 5 },
  { name: "Connoisseur", from: 15 },
  { name: "Snob", from: 30 },
  { name: "Head Snob", from: 60 },
] as const;

export function snobStatus(logCount: number): { name: string; next: { name: string; needed: number } | null } {
  const n = Math.max(0, Math.floor(Number.isFinite(logCount) ? logCount : 0));
  const idx = TIERS.reduce((best, t, i) => (n >= t.from ? i : best), 0);
  const next = TIERS[idx + 1];
  return { name: TIERS[idx].name, next: next ? { name: next.name, needed: next.from - n } : null };
}
