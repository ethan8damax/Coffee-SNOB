import { config } from "./config";
import { clusterPlaces, mergeCluster } from "./dedupe";
import { keepPlace, learnChainSignals } from "./filter";
import { assignIds } from "./identity";
import type { ChainEntry } from "./index";
import { fromOsm, fromOverture, type IndexPlace, type OsmRow, type OvertureRow, type SourcePlace } from "./place";
import { buildReport, type Report } from "./report";
import { scorePlace } from "./visibility";

export type BuildInput = {
  osm: OsmRow[];
  overture: OvertureRow[];
  chains: ChainEntry[];
  prevIdMap: Record<string, string>;
  prevIds: Set<string> | null;
};

// The whole index build minus I/O: normalise → dedupe → filter → score → ids.
// Ids go to kept places only, so a chain's records never claim a cs_ id.
export function buildIndex(input: BuildInput): { places: IndexPlace[]; idMap: Record<string, string>; report: Report } {
  const sources = [...input.overture.map(fromOverture), ...input.osm.map(fromOsm)].filter((p): p is SourcePlace => p !== null);
  const all = clusterPlaces(sources, config.dedupeRadiusM, config.similarNameMin).map(mergeCluster);
  const learned = learnChainSignals(all, input.chains);
  const merged = fillCountries(all.filter((p) => keepPlace(p, input.chains, learned)));
  const { ids, idMap } = assignIds(merged.map((p) => p.sourceIds), input.prevIdMap);
  const places = merged.map((p, i) => ({ ...p, id: ids[i], ...scorePlace(p) }));
  return { places, idMap, report: buildReport(places, input.prevIds, input.chains) };
}

// OSM-only places carry no address. Borrow the country of the nearest place
// that has one.
// ponytail: nearest neighbour on a 0.5° grid. Ceiling: a café a few hundred
// metres from a border can borrow the neighbour's country. Upgrade path:
// point-in-polygon against Overture's country division areas.
export function fillCountries<T extends { lat: number; lng: number; countryCode: string | null }>(places: T[]): T[] {
  const step = 0.5;
  const key = (y: number, x: number) => `${y}:${x}`;
  const grid = new Map<string, T[]>();
  for (const p of places) {
    if (!p.countryCode) continue;
    const k = key(Math.floor(p.lat / step), Math.floor(p.lng / step));
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(p);
  }
  return places.map((p) => {
    if (p.countryCode) return p;
    const cy = Math.floor(p.lat / step);
    const cx = Math.floor(p.lng / step);
    let best: T | null = null;
    let bestD = Infinity;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        for (const q of grid.get(key(cy + dy, cx + dx)) ?? []) {
          const d = (q.lat - p.lat) ** 2 + (q.lng - p.lng) ** 2;
          if (d < bestD) [best, bestD] = [q, d];
        }
    return best ? { ...p, countryCode: best.countryCode } : p;
  });
}
