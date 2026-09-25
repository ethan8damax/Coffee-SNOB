import { isChain, isCoffeePlace, type ChainEntry } from "./index";
import type { MergedPlace } from "./place";

// Same rules as the live map (isCoffeePlace, isChain), applied to the merged
// place. Overrides and user flags join in Phase 3.
export function keepPlace(p: MergedPlace, chains: ChainEntry[]): boolean {
  if (p.closed) return false;
  if (!isCoffeePlace({ name: p.name, cuisine: p.cuisine.join(";") })) return false;
  const tags: Record<string, string> = { name: p.name };
  if (p.brand) tags.brand = p.brand;
  if (p.brandWikidata) tags["brand:wikidata"] = p.brandWikidata;
  return !isChain(tags, chains);
}
