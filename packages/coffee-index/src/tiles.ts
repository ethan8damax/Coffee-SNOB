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
