import { isChain, isCoffeePlace, normalizeChainName, type ChainEntry } from "./index";
import type { MergedPlace } from "./place";

// Hosts many unrelated businesses use for their "website": never a chain signal.
const PLATFORMS = new Set([
  "facebook.com", "instagram.com", "linktr.ee", "google.com", "goo.gl", "maps.app.goo.gl", "yelp.com",
  "square.site", "toasttab.com", "order.online", "doordash.com", "ubereats.com", "grubhub.com",
  "placeweb.site", "business.site", "wixsite.com", "squarespace.com", "tripadvisor.com", "x.com", "twitter.com",
]);

export const websiteDomain = (url: string | null) =>
  url ? url.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#:]/)[0] || null : null;

export type ChainSignals = { names: Set<string>; domains: Set<string> };

const tagsOf = (p: MergedPlace): Record<string, string> => {
  const tags: Record<string, string> = { name: p.name };
  if (p.brand) tags.brand = p.brand;
  if (p.brandWikidata) tags["brand:wikidata"] = p.brandWikidata;
  return tags;
};

// Many records carry no brand at all ("Starbucks Coffee", "Dunkin' Donuts"
// from Overture). Learn from the records that are blocked by brand: their
// exact names, and website domains that belong to one chain or carry the
// chain's own name (never shared platforms like facebook.com). Then block
// unbranded records that share them. Exact matches only, so the blocklist's
// "Costa Rica Café" protection holds.
// ponytail: learned per build, not stored. Ceiling: a pilot bbox learns less
// than a worldwide build. Upgrade path: persist learned signals if pilots matter.
export function learnChainSignals(places: MergedPlace[], chains: ChainEntry[]): ChainSignals {
  const chainByWikidata = new Map(chains.filter((c) => c.wikidata).map((c) => [c.wikidata!, c.name]));
  const names = new Set<string>();
  const owners = new Map<string, Set<string>>();
  const named = new Set<string>();
  for (const p of places) {
    if (!p.brandWikidata || !isChain(tagsOf(p), chains)) continue;
    names.add(normalizeChainName(p.name));
    const d = websiteDomain(p.website);
    if (!d || PLATFORMS.has(d)) continue;
    (owners.get(d) ?? owners.set(d, new Set()).get(d)!).add(p.brandWikidata);
    const chainName = chainByWikidata.get(p.brandWikidata) ?? "";
    const word = chainName.split(" ").reduce((a, b) => (b.length > a.length ? b : a), "");
    if (word.length >= 4 && d.replace(/[^a-z0-9]/g, "").includes(word)) named.add(d);
  }
  // A domain only one chain uses (mcdonalds.com for McCafé), or one carrying
  // the chain's name even if two entries share it (starbucks.com).
  const domains = new Set([...owners].filter(([d, o]) => o.size === 1 || named.has(d)).map(([d]) => d));
  return { names, domains };
}

// Same rules as the live map (isCoffeePlace, isChain), applied to the merged
// place, plus the learned chain signals. Overrides and flags join in Phase 3.
export function keepPlace(p: MergedPlace, chains: ChainEntry[], learned?: ChainSignals): boolean {
  if (p.closed) return false;
  if (!isCoffeePlace({ name: p.name, cuisine: p.cuisine.join(";") })) return false;
  if (isChain(tagsOf(p), chains)) return false;
  if (!learned) return true;
  const d = websiteDomain(p.website);
  return !learned.names.has(normalizeChainName(p.name)) && !(d && learned.domains.has(d));
}
