// Add a shop: the optional fields, turned into what shops store.

export const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;
export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type DayHours = { open: boolean; from: string; to: string };
export const emptyWeek = (): DayHours[] => DAYS.map(() => ({ open: false, from: "", to: "" }));

const pad = (n: number) => String(n).padStart(2, "0");

// What people type → "HH:MM": 7, 7am, 7:30, 7.30pm, 1530, noon. null if it isn't a time.
export function parseTime(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, "");
  if (s === "noon") return "12:00";
  if (s === "midnight") return "00:00";
  const m = s.match(/^(\d{1,2})(?:[:.]?(\d{2}))?(am|pm|a|p)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ampm = m[3]?.[0];
  if (min > 59) return null;
  if (ampm) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (ampm === "p" ? 12 : 0);
  } else if (h > 23) return null;
  return `${pad(h)}:${pad(min)}`;
}

// A close time with no am/pm that lands before opening ("7" to "3") means afternoon.
export function closeTime(from: string, input: string): string | null {
  const t = parseTime(input);
  if (!t) return null;
  const explicit = /[ap]m?$|noon|midnight/i.test(input.trim());
  if (!explicit && t < from && Number(t.slice(0, 2)) < 12) return `${pad(Number(t.slice(0, 2)) + 12)}${t.slice(2)}`;
  return t;
}

function span(d: DayHours): string | null {
  if (!d.open) return null;
  const from = parseTime(d.from);
  const to = from ? closeTime(from, d.to) : null;
  return from && to ? `${from}-${to}` : null;
}

// OSM opening_hours, days with the same hours grouped: "Mo-Fr 07:00-15:00; Sa,Su 08:00-14:00".
export function formatHours(week: DayHours[]): string {
  const spans = week.map(span);
  const rules: string[] = [];
  let i = 0;
  while (i < 7) {
    if (!spans[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < 7 && spans[j + 1] === spans[i]) j++;
    const days = j === i ? DAYS[i] : j === i + 1 ? `${DAYS[i]},${DAYS[j]}` : `${DAYS[i]}-${DAYS[j]}`;
    rules.push(`${days} ${spans[i]}`);
    i = j + 1;
  }
  return rules.join("; ");
}

// Website or Instagram, as a link: "@wuzhere" → instagram, "wuzhere.com" → https://.
export function toWebsite(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (/^@[\w.]{1,30}$/.test(s)) return `https://www.instagram.com/${s.slice(1)}`;
  if (/^https?:\/\/\S+\.\S+$/i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s)) return `https://${s}`;
  return null;
}
