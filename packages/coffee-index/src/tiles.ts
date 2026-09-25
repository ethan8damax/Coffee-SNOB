// Same grid as the app's snapToGrid (apps/app/lib/map/bounds.ts), so a
// viewport maps to a handful of tile URLs.
const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function tileKey(lat: number, lng: number, step: number): string {
  const snap = (n: number) => round(Math.floor(round(n / step)) * step);
  return `${snap(lat)}_${snap(lng)}`;
}

export function toTiles<T extends { lat: number; lng: number }>(places: T[], step: number): Map<string, T[]> {
  const tiles = new Map<string, T[]>();
  for (const p of places) {
    const k = tileKey(p.lat, p.lng, step);
    const tile = tiles.get(k);
    if (tile) tile.push(p);
    else tiles.set(k, [p]);
  }
  return tiles;
}

// Dense cells (Ho Chi Minh City has 10k cafés in one 0.1° cell) are written
// as finer cells instead, so no single download gets big. The app learns
// which cells are split from the version manifest.
export function layoutTiles<T extends { lat: number; lng: number }>(
  places: T[],
  cfg: { tileStep: number; splitStep: number; splitAbove: number },
): { coarse: Map<string, T[]>; fine: Map<string, T[]>; split: string[] } {
  const coarse = toTiles(places, cfg.tileStep);
  const fine = new Map<string, T[]>();
  const split: string[] = [];
  for (const [key, ps] of coarse) {
    if (ps.length <= cfg.splitAbove) continue;
    coarse.delete(key);
    split.push(key);
    for (const [k, f] of toTiles(ps, cfg.splitStep)) fine.set(k, f);
  }
  return { coarse, fine, split: split.sort() };
}

// Name search files: compact [id, name, lat, lng] rows per cell.
export type SearchRow = [string, string, number, number];
export function searchRows(places: { id: string; name: string; lat: number; lng: number }[], step: number): Map<string, SearchRow[]> {
  const rows = new Map<string, SearchRow[]>();
  const r5 = (n: number) => Math.round(n * 1e5) / 1e5;
  for (const p of places) {
    const k = tileKey(p.lat, p.lng, step);
    const row: SearchRow = [p.id, p.name, r5(p.lat), r5(p.lng)];
    const list = rows.get(k);
    if (list) list.push(row);
    else rows.set(k, [row]);
  }
  return rows;
}
