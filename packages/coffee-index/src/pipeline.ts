import { config } from "./config";
import { clusterPlaces, mergeCluster } from "./dedupe";
import { keepPlace } from "./filter";
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
  const merged = clusterPlaces(sources, config.dedupeRadiusM, config.similarNameMin)
    .map(mergeCluster)
    .filter((p) => keepPlace(p, input.chains));
  const { ids, idMap } = assignIds(merged.map((p) => p.sourceIds), input.prevIdMap);
  const places = merged.map((p, i) => ({ ...p, id: ids[i], ...scorePlace(p) }));
  return { places, idMap, report: buildReport(places, input.prevIds, input.chains) };
}
