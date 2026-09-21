// OSM opening_hours is shown raw (no parsing) — one rule per line.
export function hoursLines(hours: string | null): string[] {
  if (!hours) return [];
  return hours
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}
