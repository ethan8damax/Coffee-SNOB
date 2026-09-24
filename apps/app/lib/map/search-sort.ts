import { distanceKm } from "./shop-list";
import type { Place } from "./geocode";
import type { NearbyShopPin, RatedShopPin } from "../../components/map/types";

// A shop's secondary line comes from data we already have: a rated shop's
// neighborhood, or a live OSM match's address; null when unknown. "shop" =
// already rated in our DB; "nearby" = a live OSM match with no shops row yet
// (most early searches are someone looking to rate/log a shop for the first time).
export type SearchResult =
  | { kind: "place"; place: Place }
  | { kind: "shop"; shop: RatedShopPin; secondary: string | null }
  | { kind: "nearby"; shop: NearbyShopPin; secondary: string | null };

function resultPoint(r: SearchResult) {
  return r.kind === "place" ? r.place : r.shop;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function resultName(r: SearchResult): string {
  return r.kind === "place" ? r.place.primary : r.shop.name;
}

// OSM id when there is one, so the same café from different sources collapses.
function resultKey(r: SearchResult): string {
  if (r.kind === "place") return `p:${r.place.id}`;
  if (r.kind === "shop") return r.shop.externalId ?? `s:${r.shop.id}`;
  return r.shop.externalId;
}

// Search results arrive in stages; later stages can repeat a shop an earlier
// one found. Keep one per key, preferring the rated version (it has a verdict).
export function mergeResults(existing: SearchResult[], incoming: SearchResult[]): SearchResult[] {
  const byKey = new Map(existing.map((r) => [resultKey(r), r]));
  for (const r of incoming) {
    const k = resultKey(r);
    const prev = byKey.get(k);
    if (!prev || (prev.kind !== "shop" && r.kind === "shop")) byKey.set(k, r);
  }
  return [...byKey.values()];
}

// 0 exact name, 1 name starts with the query, 2 query starts a later word,
// 3 anything else (fuzzy matches from Photon).
function matchTier(name: string, q: string): number {
  const n = normalize(name);
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (` ${n}`.includes(` ${q}`)) return 2;
  return 3;
}

// Best name match first; within a tier rated shops before everything else,
// then nearest to what's on screen. Places keep their source order (Photon's
// importance + location bias), so the state of Georgia isn't outranked by a
// nearer hamlet named Georgia.
export function rankResults(results: SearchResult[], query: string, origin: { lat: number; lng: number } | null): SearchResult[] {
  const q = normalize(query);
  const score = (r: SearchResult) => ({
    tier: matchTier(resultName(r), q),
    rated: r.kind === "shop" ? 0 : 1,
    dist: origin && r.kind !== "place" ? distanceKm(origin, resultPoint(r)) : 0,
  });
  return results
    .map((r) => ({ r, s: score(r) }))
    .sort((a, b) => a.s.tier - b.s.tier || a.s.rated - b.s.rated || a.s.dist - b.s.dist)
    .map(({ r }) => r);
}
