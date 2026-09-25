import { createHash } from "node:crypto";

const anchor = (sourceIds: string[]) => sourceIds.find((s) => s.startsWith("ov:")) ?? [...sourceIds].sort()[0];
const hashId = (s: string) => `cs_${createHash("sha1").update(s).digest("hex").slice(0, 12)}`;

// A place's cs_ id must survive monthly rebuilds: shops.external_id points at
// it once someone logs a visit. Any source id seen before hands its old id
// on; new places hash their anchor source id, never reusing an id from the
// previous map. Vanished sources stay in the map so a comeback keeps its id.
export function assignIds(clusters: string[][], prev: Record<string, string>): { ids: string[]; idMap: Record<string, string> } {
  const prevIds = new Set(Object.values(prev));
  const used = new Set<string>();
  const idMap: Record<string, string> = { ...prev };
  const ids = clusters.map((sourceIds) => {
    let id = sourceIds.map((s) => prev[s]).find((old) => old !== undefined && !used.has(old));
    if (!id) {
      const base = anchor(sourceIds);
      id = hashId(base);
      for (let n = 1; used.has(id) || prevIds.has(id); n++) id = hashId(`${base}#${n}`);
    }
    used.add(id);
    for (const s of sourceIds) idMap[s] = id;
    return id;
  });
  return { ids, idMap };
}
