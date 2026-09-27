import { nearIdentical, similarity } from "./dedupe";

// Phase 6 (docs/superpowers/specs/2026-09-27-curation-phase-6-freshness-design.md).
export type RatedRef = { externalId: string; name: string; lat: number; lng: number };
export type MissingRated = { externalId: string; builds: number };

type Placed = { id: string; name: string; lat: number; lng: number; sourceIds: string[] };

const USER = "user/";
const LINK_M = 75;
const M_PER_DEG = 111_320;

// Rated shops no source has any more, with how many builds in a row. Shops
// people added themselves never came from a source, so they're skipped.
export function missingRated(places: Placed[], rated: RatedRef[], prev: MissingRated[]): MissingRated[] {
  const ids = new Set<string>();
  for (const p of places) {
    ids.add(p.id);
    // Older shops carry an OSM id without the prefix ("node/123").
    for (const s of p.sourceIds) ids.add(s.startsWith("osm:") ? s.slice(4) : s);
  }
  const before = new Map(prev.map((m) => [m.externalId, m.builds]));
  return rated
    .filter((r) => !r.externalId.startsWith(USER) && !ids.has(r.externalId))
    .map((r) => ({ externalId: r.externalId, builds: (before.get(r.externalId) ?? 0) + 1 }));
}

// A shop someone added by hand ("user/<uuid>") joins the index place that is
// clearly the same café: within 75 m, same name. The link rides in the
// place's sourceIds, where the map already looks for rated duplicates and
// legacy ids. Mutates places; returns how many were linked.
// ponytail: 0.001° grid (~110 m) built only around the added shops.
export function linkUserShops(places: Placed[], rated: RatedRef[]): number {
  const added = rated.filter((r) => r.externalId.startsWith(USER));
  if (!added.length) return 0;
  const cell = (lat: number, lng: number) => `${Math.floor(lat * 1000)}:${Math.floor(lng * 1000)}`;
  const wanted = new Set<string>();
  for (const r of added)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) wanted.add(cell(r.lat + dy / 1000, r.lng + dx / 1000));
  const grid = new Map<string, Placed[]>();
  for (const p of places) {
    const k = cell(p.lat, p.lng);
    if (wanted.has(k)) (grid.get(k) ?? grid.set(k, []).get(k)!).push(p);
  }

  let linked = 0;
  for (const r of added) {
    let best: Placed | null = null;
    let bestD = Infinity;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        for (const p of grid.get(cell(r.lat + dy / 1000, r.lng + dx / 1000)) ?? []) {
          const d = Math.hypot((p.lat - r.lat) * M_PER_DEG, (p.lng - r.lng) * M_PER_DEG * Math.cos((r.lat * Math.PI) / 180));
          if (d <= LINK_M && d < bestD && (nearIdentical(p.name, r.name) || similarity(p.name, r.name) >= 0.5)) [best, bestD] = [p, d];
        }
    if (best && !best.sourceIds.includes(r.externalId)) {
      best.sourceIds.push(r.externalId);
      linked++;
    }
  }
  return linked;
}
