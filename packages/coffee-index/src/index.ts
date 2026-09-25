// Shared coffee/chain filters. Used by the web app's map and search today and
// by the monthly coffee index build later (docs/superpowers/specs/
// 2026-09-25-curation-system-design.md).

// OSM files bubble tea shops, tea rooms and institutional cafeterias under
// amenity=cafe too. Anything with a coffee cuisine (coffee_shop, coffee) or a
// coffee word in its name (coffee/café/caffè/espresso) stays. Otherwise drop tea
// cuisines (alone or mixed, e.g. "bubble_tea;ice_cream"), cafeteria/diner
// names, and names with "tea"/"boba" (many tea shops carry no cuisine tag).
// Named case list, not a classifier:
// extend as new noise shows up in real areas.
const NON_COFFEE_CUISINES = new Set(["bubble_tea", "tea"]);
const NON_COFFEE_NAME = /\b(cafeteria|dining hall|food court|diner)\b/i;
const TEA_NAME = /\b(tea|boba)\b/i;
const COFFEE_NAME = /\b(coffee|caf[eé]|caff[eè]|espresso)(?![a-z])/i; // lookahead, not \b: "é" isn't a \w character

export function isCoffeePlace(tags: Record<string, string>): boolean {
  const cuisines = (tags.cuisine ?? "").split(";").map((c) => c.trim().toLowerCase()).filter(Boolean);
  if (cuisines.some((c) => c.includes("coffee"))) return true;
  if (cuisines.some((c) => NON_COFFEE_CUISINES.has(c))) return false;
  const name = tags.name ?? "";
  if (COFFEE_NAME.test(name)) return true;
  return !NON_COFFEE_NAME.test(name) && !TEA_NAME.test(name);
}

// Chain filter (chain_blocklist, managed at /admin/shops). Blocklist entries
// and OSM names are compared in one normalized form so "Dunkin'", "DUNKIN"
// and "Dunkin' Donuts" all reduce to something starting with "dunkin".
// Letters in every script survive ("スターバックス 南京"); only whitespace and
// punctuation separate words. The separator list is spelled out, not a
// locale class, so the SQL twin (is_chain_name) matches it in any locale.
export const NAME_SEPARATORS = "\\s!-/:-@\\[-`{-~\\u00a0\\u00b7\\u2010-\\u2027\\u3000-\\u303f\\u30fb\\uff01-\\uff0f\\uff1a-\\uff20";
const SEPARATORS = new RegExp(`[${NAME_SEPARATORS}]+`, "g");
export function normalizeChainName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/([a-z])[\u0300-\u036f]+/g, "$1") // accents on Latin letters only (й stays й); NFC recomposes the rest
    .normalize("NFC")
    .replace(/['’]/g, "")
    .replace(SEPARATORS, " ")
    .trim();
}

// A shop is a chain if its OSM brand:wikidata ID is on the list (works in any
// country or script), or by name/brand — including their English versions, so
// "スターバックス" tagged brand:en=Starbucks still matches. Entries with an ID
// match names exactly (the ID already covers tagged branches, and a loose match
// on "costa" would hide "Costa Rica Café"); name-only entries also match as
// leading whole words ("dunkin" catches "Dunkin' Donuts", not "Dunkinville").
// Keep in step with public.is_chain_name (supabase/migrations/0024);
// test/chain-twins.test.ts enforces it.
// prefix: an entry with a brand ID that an admin chose to also match leading
// words ("tim hortons" → "Tim Hortons Cafe and Bake Shop"). Never automatic.
export type ChainEntry = { name: string; wikidata: string | null; prefix?: boolean };

export function isChain(tags: Record<string, string>, chains: ChainEntry[]): boolean {
  const ids = (tags["brand:wikidata"] ?? "").split(";").map((s) => s.trim());
  if (chains.some((c) => c.wikidata && ids.includes(c.wikidata))) return true;
  const names = [tags.name, tags.brand, tags["brand:en"], tags["name:en"]].filter(Boolean).map(normalizeChainName);
  return names.some((n) => chains.some((c) => n === c.name || ((!c.wikidata || c.prefix) && n.startsWith(c.name + " "))));
}
