import { createReadStream, createWriteStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";
import { parseArgs } from "node:util";
import { createGunzip, createGzip, gzipSync } from "node:zlib";
import { createSupabaseClient, getChainDecisions, getPlaceFlagCounts, getPlaceOverrides } from "@coffeesnob/supabase";
import { config } from "./config";
import { extractOsm, extractOverture, sourceVersions, type BBox } from "./extract";
import { buildIndex } from "./pipeline";
import type { IndexPlace } from "./place";
import { reportMarkdown } from "./report";
import { layoutTiles, searchRows } from "./tiles";

// pnpm --filter @coffeesnob/coffee-index build-index
//   [--bbox=minLng,minLat,maxLng,maxLat] (with "=": western longitudes start with "-")
//   [--prev <earlier build>/v/<version>] [--out out] [--first-run] [--allow-big-change]
// Writes <out>/<version>/ exactly as it is uploaded: manifest.json (the root
// pointer, uploaded last) and v/<version>/ (tiles, tiles-fine, search, the
// full index, id_map, report).
// Needs SUPABASE_URL + SUPABASE_ANON_KEY (or the NEXT_PUBLIC_ pair) for the
// public chain blocklist; a chain-less index must never publish.
const { values } = parseArgs({
  options: {
    bbox: { type: "string" },
    prev: { type: "string" },
    out: { type: "string", default: "out" },
    "first-run": { type: "boolean", default: false },
    "allow-big-change": { type: "boolean", default: false },
  },
});

function fail(message: string, code = 1): never {
  console.error(message);
  process.exit(code);
}

const bbox: BBox | undefined = values.bbox
  ? (([minLng, minLat, maxLng, maxLat]) => ({ minLng, minLat, maxLng, maxLat }))(values.bbox.split(",").map(Number))
  : undefined;
if (bbox && Object.values(bbox).some((n) => !Number.isFinite(n))) fail("--bbox must be minLng,minLat,maxLng,maxLat");
if (!values.prev && !values["first-run"]) {
  fail("No --prev build given. Pass the last build's folder so ids stay stable, or --first-run for the very first build.");
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
if (!url || !key) fail("SUPABASE_URL and SUPABASE_ANON_KEY are required (the chain blocklist is public-read).");

// The worldwide place list is bigger than the largest string V8 allows, so it
// is written and read one line at a time.
async function readIds(path: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for await (const line of createInterface({ input: createReadStream(path).pipe(createGunzip()) })) {
    if (line) ids.add((JSON.parse(line) as IndexPlace).id);
  }
  return ids;
}

async function main() {
  const started = Date.now();
  const secs = () => Math.round((Date.now() - started) / 1000);
  const versions = await sourceVersions();
  console.log("sources", versions);
  const cacheDir = resolve(".cache");
  // One source at a time: the download is the bottleneck, and two worldwide
  // scans side by side doubled memory without finishing any sooner.
  const supabase = createSupabaseClient(url, key);
  const [decided, overrides, flagCounts] = await Promise.all([getChainDecisions(supabase), getPlaceOverrides(supabase), getPlaceFlagCounts(supabase)]);
  const chains = decided.filter((c) => c.status === "blocked");
  const notSpecialty = Object.fromEntries(flagCounts.map((f) => [f.placeId, f.notSpecialty]));
  console.log(`controls: ${chains.length} chains blocked, ${decided.length - chains.length} allowed, ${overrides.length} overrides, ${flagCounts.length} flagged places`);
  const osm = await extractOsm(versions.layercake, cacheDir, bbox);
  console.log(`osm ${osm.length} (${secs()}s)`);
  const overture = await extractOverture(versions.overture, cacheDir, bbox);
  console.log(`extracted osm=${osm.length} overture=${overture.length} chains=${chains.length} (${secs()}s)`);

  const prevDir = values.prev ? resolve(values.prev) : null;
  const prevIdMap: Record<string, string> = prevDir ? JSON.parse(readFileSync(join(prevDir, "id_map.json"), "utf8")) : {};
  const prevIds = prevDir ? await readIds(join(prevDir, "places.ndjson.gz")) : null;

  const { places, idMap, report } = buildIndex({ osm, overture, chains, prevIdMap, prevIds, overrides, notSpecialty, decided });
  const builtAt = new Date().toISOString();
  const version = builtAt.slice(0, 16).replace(/:/g, "") + (bbox ? "-bbox" : "");
  const rootDir = resolve(values.out!, version);
  const outDir = join(rootDir, "v", version);
  for (const d of ["tiles", "tiles-fine", "search"]) mkdirSync(join(outDir, d), { recursive: true });

  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(outDir, "report.md"), reportMarkdown(report, { builtAt, sources: versions }));
  if (report.alarm && !values["allow-big-change"]) {
    fail(`ALARM: ${report.alarm}. Tiles not written. Check ${join(outDir, "report.md")}, then rerun with --allow-big-change if it's real.`, 2);
  }

  const r6 = (n: number) => Math.round(n * 1e6) / 1e6; // ~10 cm, drops float noise
  // What the map needs per dot (parent spec 4.3).
  const entry = (p: IndexPlace) => ({
    id: p.id, sourceIds: p.sourceIds, name: p.name, lat: r6(p.lat), lng: r6(p.lng),
    address: p.address, locality: p.locality, region: p.region, countryCode: p.countryCode,
    website: p.website, phone: p.phone, hours: p.hours, visibility: p.visibility, why: p.why,
  });
  // Tile and search files are gzip bytes named .json: the host sends them
  // with Content-Encoding: gzip, so fetch() decodes them for free.
  const write = (dir: string, groups: Map<string, unknown[]>) => {
    for (const [k, rows] of groups) writeFileSync(join(outDir, dir, `${k}.json`), gzipSync(JSON.stringify(rows)));
  };
  const { coarse, fine, split } = layoutTiles(places.map(entry), config);
  write("tiles", coarse);
  write("tiles-fine", fine);
  write("search", searchRows(places, config.searchStep));
  await pipeline(
    (function* () {
      for (const p of places) yield JSON.stringify(p) + "\n";
    })(),
    createGzip(),
    createWriteStream(join(outDir, "places.ndjson.gz")),
  );
  writeFileSync(join(outDir, "id_map.json"), JSON.stringify(idMap));
  writeFileSync(
    join(outDir, "manifest.json"),
    JSON.stringify({
      version, builtAt, configVersion: config.version, sources: versions, bbox: bbox ?? null, count: places.length,
      tileStep: config.tileStep, splitStep: config.splitStep, searchStep: config.searchStep, split,
    }, null, 2),
  );
  writeFileSync(join(rootDir, "manifest.json"), JSON.stringify({ version }));
  console.log(`built ${places.length} places in ${coarse.size} tiles + ${fine.size} fine (${split.length} split) → ${rootDir} (${secs()}s)`);
}

main().catch((error) => fail(String(error?.stack ?? error)));
