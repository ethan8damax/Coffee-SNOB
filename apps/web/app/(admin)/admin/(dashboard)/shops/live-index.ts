// The live coffee index's manifest and build report, read from the public
// bucket (COFFEE_INDEX_ORIGIN). Cached an hour: a build lands once a month.
export type SuggestedChain = { key: string; name: string; countryCode: string; count: number };
export type LiveReport = {
  count: number;
  byCountry: Record<string, number>;
  added: number | null;
  removed: number | null;
  suggestedChains: SuggestedChain[];
  alarm: string | null;
};
export type LiveManifest = {
  version: string;
  builtAt: string;
  sources: Record<string, string>;
  count: number;
  split: string[];
};
export type LiveIndex = { origin: string; manifest: LiveManifest; report: LiveReport };

export async function getLiveIndex(): Promise<LiveIndex | "unconfigured" | "unavailable"> {
  const origin = process.env.COFFEE_INDEX_ORIGIN?.replace(/\/$/, "");
  if (!origin) return "unconfigured";
  try {
    const get = async <T,>(path: string) => {
      const res = await fetch(`${origin}/${path}`, { next: { revalidate: 3600 } });
      if (!res.ok) throw new Error(`${path}: ${res.status}`);
      return (await res.json()) as T;
    };
    const { version } = await get<{ version: string }>("manifest.json");
    const [manifest, report] = await Promise.all([
      get<LiveManifest>(`v/${version}/manifest.json`),
      get<LiveReport>(`v/${version}/report.json`),
    ]);
    return { origin, manifest, report };
  } catch {
    return "unavailable";
  }
}

// One row per chain: the build groups by country, the admin decides once.
export function groupSuggestions(list: SuggestedChain[]) {
  const byKey = new Map<string, { key: string; name: string; total: number; countries: { code: string; count: number }[] }>();
  for (const s of list) {
    const g = byKey.get(s.key) ?? { key: s.key, name: s.name, total: 0, countries: [] };
    g.total += s.count;
    g.countries.push({ code: s.countryCode, count: s.count });
    byKey.set(s.key, g);
  }
  return [...byKey.values()]
    .map((g) => ({ ...g, countries: g.countries.sort((a, b) => b.count - a.count) }))
    .sort((a, b) => b.total - a.total);
}
