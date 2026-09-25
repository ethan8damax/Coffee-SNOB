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
  const nameCounts = new Map<string, number>();
  const named = new Set<string>();
  const owners = new Map<string, Set<string>>();
  const namedDomains = new Set<string>();
  for (const p of places) {
    if (!p.brandWikidata || !isChain(tagsOf(p), chains)) continue;
    const word = longestWord(chainByWikidata.get(p.brandWikidata) ?? "");
    const key = learnKey(p.name);
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    if (word && key.replace(/ /g, "").includes(word)) named.add(key);
    const d = websiteDomain(p.website);
    if (!d || PLATFORMS.has(d)) continue;
    (owners.get(d) ?? owners.set(d, new Set()).get(d)!).add(p.brandWikidata);
    if (word && d.replace(/[^a-z0-9]/g, "").includes(word)) namedDomains.add(d);
  }
  // A name carrying the chain's own word ("Starbucks Coffee"), or one many
  // branded records share ("スターバックス"). One mis-tagged record can't teach
  // a generic name: an Atlanta "Corner Cafe" tagged as Starbucks once hid
  // every Corner Cafe in the world.
  const names = new Set([...nameCounts].filter(([k, n]) => named.has(k) || n >= 5).map(([k]) => k));
  // A domain only one chain uses (mcdonalds.com for McCafé), or one carrying
  // the chain's name even if two entries share it (starbucks.com).
  const domains = new Set([...owners].filter(([d, o]) => o.size === 1 || namedDomains.has(d)).map(([d]) => d));
  return { names, domains };
}

const longestWord = (name: string) => {
  const w = name.split(" ").reduce((a, b) => (b.length > a.length ? b : a), "");
  return w.length >= 4 ? w : "";
};

// normalizeChainName keeps only a-z and digits, so "スターバックス" would become
// "" and match every non-Latin name. Keep the original script instead.
const learnKey = (name: string) => normalizeChainName(name) || name.normalize("NFKC").toLowerCase().trim();

// Same rules as the live map (isCoffeePlace, isChain), applied to the merged
// place, plus the learned chain signals. Overrides and flags join in Phase 3.
export function keepPlace(p: MergedPlace, chains: ChainEntry[], learned?: ChainSignals): boolean {
  if (p.closed) return false;
  if (!isCoffeePlace({ name: p.name, cuisine: p.cuisine.join(";") })) return false;
  if (isChain(tagsOf(p), chains)) return false;
  if (!learned) return true;
  const d = websiteDomain(p.website);
  return !learned.names.has(learnKey(p.name)) && !(d && learned.domains.has(d));
}
