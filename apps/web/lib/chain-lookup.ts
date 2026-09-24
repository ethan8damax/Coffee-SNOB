import { normalizeChainName } from "./nearby-shops";

// Looks a chain up in OSM's Name Suggestion Index — the public list of brands
// (with their brand:wikidata IDs) that OSM mappers tag chain locations with.
// Cafés plus fast food, since Dunkin', Pret, Krispy Kreme etc. live there.
const NSI_URLS = [
  "https://raw.githubusercontent.com/osmlab/name-suggestion-index/main/data/brands/amenity/cafe.json",
  "https://raw.githubusercontent.com/osmlab/name-suggestion-index/main/data/brands/amenity/fast_food.json",
];

type NsiItem = { displayName: string; locationSet?: { include?: string[] }; tags: Record<string, string> };
export type ChainMatch = { label: string; name: string; wikidata: string; where: string };

export async function lookupChain(query: string): Promise<ChainMatch[]> {
  const q = normalizeChainName(query);
  if (!q) return [];
  const lists = await Promise.all(
    NSI_URLS.map((u) =>
      fetch(u, { next: { revalidate: 60 * 60 * 24 } })
        .then((r) => (r.ok ? (r.json() as Promise<{ items: NsiItem[] }>) : { items: [] }))
        .catch(() => ({ items: [] as NsiItem[] })),
    ),
  );
  const byId = new Map<string, ChainMatch>();
  for (const item of lists.flatMap((l) => l.items)) {
    const t = item.tags;
    const id = t["brand:wikidata"];
    if (!id || byId.has(id)) continue;
    const label = t["brand:en"] || t.brand || item.displayName;
    const names = [item.displayName, t.brand, t["brand:en"], t.name, t["name:en"]].filter(Boolean).map(normalizeChainName);
    if (!names.some((n) => n === q || n.startsWith(q + " "))) continue;
    const include = item.locationSet?.include ?? [];
    byId.set(id, {
      label,
      name: normalizeChainName(label),
      wikidata: id,
      where: include.includes("001") ? "worldwide" : include.join(", ").toUpperCase(),
    });
  }
  return [...byId.values()].slice(0, 10);
}
