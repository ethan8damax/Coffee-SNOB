// The "any shop nearby" layer — live OpenStreetMap data via Overpass, never
// bulk-imported (see docs/superpowers/specs/2026-09-03-map-community-shops-
// design.md). These are pure, easily-testable pieces of the proxy endpoint
// in app/api/nearby-shops/route.ts.

export type OverpassElement = {
  type: "node" | "way";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type NearbyShop = {
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  hours: string | null;
  website: string | null;
  phone: string | null;
};

export type Bounds = { minLat: number; minLng: number; maxLat: number; maxLng: number };

// Regex-escapes a user-typed search term, then quote-escapes it, so it's a
// literal case-insensitive substring match inside the Overpass QL query's
// own quoted string — never user-controlled regex.
function escapeOverpassName(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/"/g, '\\"');
}

// `name` narrows to shops whose OSM name matches — used for "search this
// shop by name" (searchNearbyShops), as opposed to the plain viewport fetch
// (fetchNearbyOsmShops) which wants every cafe in the box.
export function buildOverpassQuery(bounds: Bounds, name?: string): string {
  const { minLat, minLng, maxLat, maxLng } = bounds;
  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;
  const nameFilter = name ? `["name"~"${escapeOverpassName(name)}",i]` : "";
  // amenity=cafe alone misses plenty of real specialty-coffee spots that
  // live inside a restaurant/bar (a coffee-forward brunch spot, a bar that
  // does pour-overs by day) — OSM's convention there is a cuisine value of
  // "coffee_shop" (often alongside others, e.g. "mexican;coffee_shop")
  // rather than the amenity tag itself. Match on either.
  return `[out:json][timeout:25];(node["amenity"="cafe"]${nameFilter}(${bbox});way["amenity"="cafe"]${nameFilter}(${bbox});node["cuisine"~"coffee_shop"]${nameFilter}(${bbox});way["cuisine"~"coffee_shop"]${nameFilter}(${bbox}););out center;`;
}

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

export function toNearbyShop(el: OverpassElement): NearbyShop | null {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  const name = el.tags?.name;
  if (lat === undefined || lng === undefined || !name) return null;

  const tags = el.tags ?? {};
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const address = [street, tags["addr:city"]].filter(Boolean).join(", ");

  return {
    externalId: `${el.type}/${el.id}`,
    name,
    lat,
    lng,
    address: address || null,
    hours: tags["opening_hours"] ?? null,
    website: tags["website"] ?? tags["contact:website"] ?? null,
    phone: tags["phone"] ?? tags["contact:phone"] ?? null,
  };
}

// Chain filter (chain_blocklist, managed at /admin/shops). Blocklist entries
// and OSM names are compared in one normalized form so "Dunkin'", "DUNKIN"
// and "Dunkin' Donuts" all reduce to something starting with "dunkin".
export function normalizeChainName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// A shop is a chain if its OSM brand:wikidata ID is on the list (works in any
// country or script), or by name/brand — including their English versions, so
// "スターバックス" tagged brand:en=Starbucks still matches. Entries with an ID
// match names exactly (the ID already covers tagged branches, and a loose match
// on "costa" would hide "Costa Rica Café"); name-only entries also match as
// leading whole words ("dunkin" catches "Dunkin' Donuts", not "Dunkinville").
// Keep in step with public.is_chain_name (supabase/migrations/0024).
export type ChainEntry = { name: string; wikidata: string | null };

export function isChain(tags: Record<string, string>, chains: ChainEntry[]): boolean {
  const ids = (tags["brand:wikidata"] ?? "").split(";").map((s) => s.trim());
  if (chains.some((c) => c.wikidata && ids.includes(c.wikidata))) return true;
  const names = [tags.name, tags.brand, tags["brand:en"], tags["name:en"]].filter(Boolean).map(normalizeChainName);
  return names.some((n) => chains.some((c) => n === c.name || (!c.wikidata && n.startsWith(c.name + " "))));
}
