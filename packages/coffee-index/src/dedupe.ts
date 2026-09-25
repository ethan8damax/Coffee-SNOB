import { normalizeChainName } from "./index";
import type { MergedPlace, SourcePlace } from "./place";

const EARTH_M_PER_DEG = 111_320;

export const nameKey = (name: string) => normalizeChainName(name);

// Shared words over the longer name's word count: 1 only for the same words.
export function similarity(a: string, b: string): number {
  const wa = new Set(nameKey(a).split(" ").filter(Boolean));
  const wb = new Set(nameKey(b).split(" ").filter(Boolean));
  if (!wa.size || !wb.size) return 0;
  return [...wa].filter((w) => wb.has(w)).length / Math.max(wa.size, wb.size);
}

// Words that say "this is a café" rather than which one. Ignored when
// comparing names, so "East Pole Coffee Co." meets "East Pole Coffee Company".
const FILLER = new Set(["the", "and", "co", "company", "coffee", "coffeehouse", "house", "cafe", "caffe", "roasters", "roastery", "roasting", "shop", "bar", "espresso", "llc", "inc"]);

function coreKey(name: string): string {
  const key = nameKey(name);
  const core = key.split(" ").filter((w) => !FILLER.has(w)).join(" ");
  return core || key; // a name that is all filler ("The Coffee Bar") keeps its words
}

// Same core name, or one is the other plus trailing words ("Spiller Park SP1").
function nearIdentical(a: string, b: string): boolean {
  const ka = coreKey(a);
  const kb = coreKey(b);
  return ka === kb || ka.startsWith(kb + " ") || kb.startsWith(ka + " ");
}

const domain = (url: string | null) =>
  url ? url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0] : null;
const digits = (phone: string | null) => (phone ? phone.replace(/\D/g, "").slice(-9) : null);

function distanceM(a: SourcePlace, b: SourcePlace): number {
  const dLat = (a.lat - b.lat) * EARTH_M_PER_DEG;
  const dLng = (a.lng - b.lng) * EARTH_M_PER_DEG * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLng);
}

function sameCafe(a: SourcePlace, b: SourcePlace, radiusM: number, similarMin: number): boolean {
  if (distanceM(a, b) > radiusM) return false;
  if (nearIdentical(a.name, b.name)) return true;
  if (similarity(a.name, b.name) < similarMin) return false;
  const da = domain(a.website);
  const pa = digits(a.phone);
  return (da !== null && da === domain(b.website)) || (pa !== null && pa.length >= 7 && pa === digits(b.phone));
}

// Groups records that describe the same café. Conservative on purpose: when
// unsure, two dots beat one wrong merge.
// ponytail: grid buckets + union-find, linear for real densities. Ceiling: a
// cell with thousands of same-spot records goes quadratic; none seen so far.
export function clusterPlaces(places: SourcePlace[], radiusM: number, similarMin: number): SourcePlace[][] {
  const cell = radiusM / EARTH_M_PER_DEG;
  const key = (y: number, x: number) => `${y}:${x}`;
  const grid = new Map<string, number[]>();
  places.forEach((p, i) => {
    const k = key(Math.floor(p.lat / cell), Math.floor(p.lng / cell));
    const bucket = grid.get(k);
    if (bucket) bucket.push(i);
    else grid.set(k, [i]);
  });

  const parent = places.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };

  places.forEach((p, i) => {
    const cy = Math.floor(p.lat / cell);
    const cx = Math.floor(p.lng / cell);
    // Longitude cells shrink toward the poles, so look further sideways there.
    const span = Math.ceil(1 / Math.max(Math.cos(p.lat * (Math.PI / 180)), 0.05));
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -span; dx <= span; dx++) {
        for (const j of grid.get(key(cy + dy, cx + dx)) ?? []) {
          if (j <= i || find(i) === find(j)) continue;
          if (sameCafe(p, places[j], radiusM, similarMin)) parent[find(j)] = find(i);
        }
      }
    }
  });

  const groups = new Map<number, SourcePlace[]>();
  places.forEach((p, i) => {
    const r = find(i);
    const g = groups.get(r);
    if (g) g.push(p);
    else groups.set(r, [p]);
  });
  return [...groups.values()];
}

const first = <T>(xs: (T | null)[]): T | null => xs.find((x) => x !== null && x !== undefined) ?? null;

// Overture first for names and addresses (it carries them), OSM first for
// hours and position (mappers put the pin on the door).
export function mergeCluster(cluster: SourcePlace[]): MergedPlace {
  const ov = cluster.filter((p) => p.sourceId.startsWith("ov:"));
  const osm = cluster.filter((p) => p.sourceId.startsWith("osm:"));
  const ovFirst = [...ov, ...osm];
  const osmFirst = [...osm, ...ov];
  const categories = cluster.map((p) => p.category);
  return {
    sourceIds: ovFirst.map((p) => p.sourceId),
    name: ovFirst[0].name,
    lat: osmFirst[0].lat,
    lng: osmFirst[0].lng,
    address: first(ovFirst.map((p) => p.address)),
    locality: first(ovFirst.map((p) => p.locality)),
    region: first(ovFirst.map((p) => p.region)),
    countryCode: first(ovFirst.map((p) => p.countryCode)),
    website: first(ovFirst.map((p) => p.website)),
    phone: first(ovFirst.map((p) => p.phone)),
    hours: first(osmFirst.map((p) => p.hours)),
    category: categories.includes("coffee_shop") ? "coffee_shop" : first(categories),
    cuisine: [...new Set(cluster.flatMap((p) => p.cuisine))],
    brand: first(ovFirst.map((p) => p.brand)),
    brandWikidata: first(ovFirst.map((p) => p.brandWikidata)),
    closed: ov.length > 0 && ov.every((p) => p.closed),
    datasets: [...new Set(ovFirst.flatMap((p) => p.datasets))],
  };
}
