import { DETOUR_LABELS } from "../../components/detour-style";

const DAY = 86_400_000;

export function relativeDate(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const days = Math.floor((now.getTime() - t) / DAY);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

export function topVerdictWord(top: number | null): string | null {
  if (top === null) return null;
  return DETOUR_LABELS[Math.max(1, Math.min(5, Math.round(top))) - 1];
}

export function verdictCountLabel(n: number): string {
  return `Snob consensus · ${n} ${n === 1 ? "verdict" : "verdicts"}`;
}

export function consensusLine(s: {
  logCount: number;
  topVerdict: number | null;
  rating: number | null;
}): { word: string; average: string | null } | null {
  const word = topVerdictWord(s.topVerdict);
  if (s.logCount <= 0 || !word) return null;
  return { word, average: s.rating === null ? null : s.rating.toFixed(1) };
}

export function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

// OSM website tags are user-entered; only ever open http(s).
export function websiteUrl(raw: string): string | null {
  const s = raw.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return null;
  return s ? `https://${s}` : null;
}
