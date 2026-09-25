// Client for the coffee index: static files built monthly by
// packages/coffee-index and served from a CDN (docs/superpowers/specs/
// 2026-09-25-curation-phase-2-serve-index-design.md). Replaces the live
// Overpass calls when EXPO_PUBLIC_COFFEE_INDEX_URL is set.
import type { MapBounds, NearbyShopPin } from "../../components/map/types";

export type IndexManifest = { version: string; tileStep: number; splitStep: number; searchStep: number; split: string[] };

export type IndexEntry = {
  id: string;
  sourceIds: string[];
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
  locality?: string | null;
  region?: string | null;
  countryCode?: string | null;
  website?: string | null;
  phone?: string | null;
  hours?: string | null;
  visibility: "show" | "dim";
  why?: string[];
};

type SearchRow = [id: string, name: string, lat: number, lng: number];

// Same rounding and key format as packages/coffee-index/src/tiles.ts.
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const cellKey = (lat: number, lng: number) => `${lat}_${lng}`;

function cellsIn(box: MapBounds, step: number): { lat: number; lng: number }[] {
  const cells: { lat: number; lng: number }[] = [];
  const from = (n: number) => Math.floor(round(n / step));
  const to = (n: number) => Math.ceil(round(n / step));
  for (let y = from(box.minLat); y < Math.max(to(box.maxLat), from(box.minLat) + 1); y++) {
    for (let x = from(box.minLng); x < Math.max(to(box.maxLng), from(box.minLng) + 1); x++) {
      cells.push({ lat: round(y * step), lng: round(x * step) });
    }
  }
  return cells;
}

// Cells covering a box. Dense cells are published as finer cells instead
// (the manifest lists them), so those are swapped for the fine cells inside
// both the box and the dense cell.
export function tileKeysFor(box: MapBounds, m: IndexManifest): { tiles: string[]; fine: string[] } {
  const split = new Set(m.split);
  const tiles: string[] = [];
  const fine: string[] = [];
  for (const c of cellsIn(box, m.tileStep)) {
    const key = cellKey(c.lat, c.lng);
    if (!split.has(key)) {
      tiles.push(key);
      continue;
    }
    const inside = {
      minLat: Math.max(box.minLat, c.lat),
      minLng: Math.max(box.minLng, c.lng),
      maxLat: Math.min(box.maxLat, round(c.lat + m.tileStep)),
      maxLng: Math.min(box.maxLng, round(c.lng + m.tileStep)),
    };
    for (const f of cellsIn(inside, m.splitStep)) fine.push(cellKey(f.lat, f.lng));
  }
  return { tiles, fine };
}

export function searchCellsAround(origin: { lat: number; lng: number }, step: number): string[] {
  const y = Math.floor(origin.lat / step);
  const x = Math.floor(origin.lng / step);
  const keys: string[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) keys.push(cellKey(round((y + dy) * step), round((x + dx) * step)));
  return keys;
}

const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// Every query word appears in the name, in any order ("pole east" finds "East Pole").
export function matchesQuery(name: string, query: string): boolean {
  const n = ` ${fold(name)}`;
  return fold(query).split(" ").filter(Boolean).every((w) => n.includes(` ${w}`));
}

export function toPin(e: IndexEntry): NearbyShopPin {
  return {
    externalId: e.id,
    sourceIds: e.sourceIds,
    name: e.name,
    lat: e.lat,
    lng: e.lng,
    address: e.address ?? null,
    hours: e.hours ?? null,
    website: e.website ?? null,
    phone: e.phone ?? null,
    visibility: e.visibility,
    why: e.why ?? [],
  };
}

// Places hidden since the last build (admin hides, two "closed" reports),
// from active_place_hides() once per session.
export function dropHidden<T extends { externalId: string }>(pins: T[], hidden: Set<string>): T[] {
  return hidden.size ? pins.filter((p) => !hidden.has(p.externalId)) : pins;
}

// ponytail: in-memory caches for the session; files are immutable per
// version, so nothing ever needs invalidating. A missing file is an empty
// cell (only cells with cafés are published). Ceiling: rural views make a
// few uncached 404 requests. Upgrade path: a per-version cell list.
const manifests = new Map<string, Promise<IndexManifest>>();
const files = new Map<string, Promise<unknown[]>>();

async function getJson<T>(url: string, missingOk: boolean): Promise<T | null> {
  const res = await fetch(url);
  if (missingOk && res.status === 404) return null;
  if (!res.ok) throw new Error(`coffee index request failed: ${res.status}`);
  return (await res.json()) as T;
}

function loadManifest(base: string): Promise<IndexManifest> {
  let m = manifests.get(base);
  if (!m) {
    m = (async () => {
      const root = await getJson<{ version: string }>(`${base}/manifest.json`, false);
      return (await getJson<IndexManifest>(`${base}/v/${root!.version}/manifest.json`, false))!;
    })();
    m.catch(() => manifests.delete(base));
    manifests.set(base, m);
  }
  return m;
}

function loadFile<T>(url: string): Promise<T[]> {
  let f = files.get(url);
  if (!f) {
    f = getJson<unknown[]>(url, true).then((rows) => rows ?? []);
    f.catch(() => files.delete(url));
    files.set(url, f);
  }
  return f as Promise<T[]>;
}

export async function fetchIndexShops(box: MapBounds, base: string): Promise<NearbyShopPin[]> {
  const m = await loadManifest(base);
  const { tiles, fine } = tileKeysFor(box, m);
  const urls = [
    ...tiles.map((k) => `${base}/v/${m.version}/tiles/${k}.json`),
    ...fine.map((k) => `${base}/v/${m.version}/tiles-fine/${k}.json`),
  ];
  const groups = await Promise.all(urls.map((u) => loadFile<IndexEntry>(u)));
  return groups.flat().map(toPin);
}

// Name search over the metro around the searcher (a 3×3 block of 1° cells).
export async function searchIndex(query: string, origin: { lat: number; lng: number }, base: string): Promise<NearbyShopPin[]> {
  const m = await loadManifest(base);
  const groups = await Promise.all(
    searchCellsAround(origin, m.searchStep).map((k) => loadFile<SearchRow>(`${base}/v/${m.version}/search/${k}.json`)),
  );
  return groups
    .flat()
    .filter(([, name]) => matchesQuery(name, query))
    .map(([id, name, lat, lng]) => ({ externalId: id, name, lat, lng, address: null, hours: null, website: null, phone: null }));
}

// Search can find one café twice: from Photon or our rated shops (OSM ids)
// and from the index (cs_ ids). Keep the other source's result and drop the
// index copy when the names match and they're within ~150 m.
export function dropNearDuplicates(index: NearbyShopPin[], others: { name: string; lat: number; lng: number }[]): NearbyShopPin[] {
  const near = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
    Math.hypot(a.lat - b.lat, (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180)) < 0.00135;
  const core = (n: string) => fold(n).replace(/\b(the|co|company|coffee|cafe|caffe|roasters|shop|bar)\b/g, "").replace(/\s+/g, " ").trim() || fold(n);
  return index.filter((p) => !others.some((o) => near(p, o) && core(o.name) === core(p.name)));
}

// "In 3 sources · Listed as a coffee shop": the build's reasons for a dot.
export function whyLine(why: string[] | undefined): string | null {
  return why?.length ? why.map((w) => w[0].toUpperCase() + w.slice(1)).join(" · ") : null;
}
