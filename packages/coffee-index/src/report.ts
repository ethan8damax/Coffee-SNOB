import { config } from "./config";
import { isChain, normalizeChainName, type ChainEntry } from "./index";

type Reportable = { id: string; countryCode: string | null; name: string; brandWikidata: string | null };

export type Report = {
  count: number;
  byCountry: Record<string, number>;
  added: number | null;
  removed: number | null;
  suggestedChains: { key: string; name: string; countryCode: string; count: number }[];
  alarm: string | null;
};

export function buildReport(places: Reportable[], prevIds: Set<string> | null, chains: ChainEntry[]): Report {
  const byCountry: Record<string, number> = {};
  for (const p of places) byCountry[p.countryCode ?? "??"] = (byCountry[p.countryCode ?? "??"] ?? 0) + 1;

  let added: number | null = null;
  let removed: number | null = null;
  let alarm: string | null = null;
  if (prevIds) {
    const ids = new Set(places.map((p) => p.id));
    added = places.filter((p) => !prevIds.has(p.id)).length;
    removed = [...prevIds].filter((id) => !ids.has(id)).length;
    const base = Math.max(prevIds.size, 1);
    const pct = (n: number) => Math.round((n / base) * 100);
    if (added / base > config.changeAlarm) alarm = `${added} places added (${pct(added)}%)`;
    else if (removed / base > config.changeAlarm) alarm = `${removed} places removed (${pct(removed)}%)`;
  }

  // Candidate chains: the same brand ID or name more than N times in one
  // country, not already blocked. The admin decides (Phase 3).
  const groups = new Map<string, Report["suggestedChains"][number]>();
  for (const p of places) {
    if (!p.countryCode) continue;
    const key = p.brandWikidata ?? normalizeChainName(p.name);
    const g = groups.get(`${p.countryCode}|${key}`) ?? { key, name: p.name, countryCode: p.countryCode, count: 0 };
    g.count++;
    groups.set(`${p.countryCode}|${key}`, g);
  }
  const suggestedChains = [...groups.values()]
    .filter((g) => g.count > config.chainSuggestMin && !isChain({ name: g.name }, chains))
    .sort((a, b) => b.count - a.count);

  return { count: places.length, byCountry, added, removed, suggestedChains, alarm };
}

export function reportMarkdown(r: Report, meta: { builtAt: string; sources: Record<string, string> }): string {
  const countries = Object.entries(r.byCountry).sort((a, b) => b[1] - a[1]).slice(0, 30);
  return [
    `# Coffee index build ${meta.builtAt}`,
    "",
    `Sources: ${Object.entries(meta.sources).map(([k, v]) => `${k} ${v}`).join(", ")}`,
    `Places: ${r.count}` + (r.added === null ? " (first build)" : ` (+${r.added} / -${r.removed})`),
    r.alarm ? `\n**ALARM:** ${r.alarm}` : "",
    "",
    "## Top countries",
    ...countries.map(([c, n]) => `- ${c}: ${n}`),
    "",
    `## Suggested chains (${r.suggestedChains.length})`,
    ...r.suggestedChains.slice(0, 100).map((g) => `- ${g.name} (${g.countryCode}, ${g.count})${/^Q\d+$/.test(g.key) ? ` ${g.key}` : ""}`),
    "",
  ].join("\n");
}
