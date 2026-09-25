import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { gunzipSync, gzipSync } from "node:zlib";
import { createSupabaseClient, getChainBlocklist } from "@coffeesnob/supabase";
import { config } from "./config";
import { extractOsm, extractOverture, sourceVersions, type BBox } from "./extract";
import { buildIndex } from "./pipeline";
import type { IndexPlace } from "./place";
import { reportMarkdown } from "./report";
import { toTiles } from "./tiles";

// pnpm --filter @coffeesnob/coffee-index build-index
//   [--bbox=minLng,minLat,maxLng,maxLat] (with "=": western longitudes start with "-") [--prev out/<earlier build>] [--out out]
//   [--first-run] [--allow-big-change]
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

async function main() {
  const started = Date.now();
  const secs = () => Math.round((Date.now() - started) / 1000);
  const versions = await sourceVersions();
  console.log("sources", versions);
  const cacheDir = resolve(".cache");
  // One source at a time: the download is the bottleneck, and two worldwide
  // scans side by side doubled memory without finishing any sooner.
  const chains = await getChainBlocklist(createSupabaseClient(url, key));
  const osm = await extractOsm(versions.layercake, cacheDir, bbox);
  console.log(`osm ${osm.length} (${secs()}s)`);
  const overture = await extractOverture(versions.overture, cacheDir, bbox);
  console.log(`extracted osm=${osm.length} overture=${overture.length} chains=${chains.length} (${secs()}s)`);

  const prevDir = values.prev ? resolve(values.prev) : null;
  const prevIdMap: Record<string, string> = prevDir ? JSON.parse(readFileSync(join(prevDir, "id_map.json"), "utf8")) : {};
  const prevIds = prevDir
    ? new Set(
        gunzipSync(readFileSync(join(prevDir, "places.ndjson.gz")))
          .toString("utf8")
          .split("\n")
          .filter(Boolean)
          .map((line) => (JSON.parse(line) as IndexPlace).id),
      )
    : null;

  const { places, idMap, report } = buildIndex({ osm, overture, chains, prevIdMap, prevIds });
  const builtAt = new Date().toISOString();
  const outDir = resolve(values.out!, builtAt.slice(0, 10) + (bbox ? "-bbox" : ""));
  mkdirSync(join(outDir, "tiles"), { recursive: true });

  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(outDir, "report.md"), reportMarkdown(report, { builtAt, sources: versions }));
  if (report.alarm && !values["allow-big-change"]) {
    fail(`ALARM: ${report.alarm}. Tiles not written. Check ${join(outDir, "report.md")}, then rerun with --allow-big-change if it's real.`, 2);
  }

  // What the map needs per dot (parent spec 4.3).
  const entry = (p: IndexPlace) => ({
    id: p.id, sourceIds: p.sourceIds, name: p.name, lat: p.lat, lng: p.lng,
    address: p.address, locality: p.locality, region: p.region, countryCode: p.countryCode,
    website: p.website, phone: p.phone, hours: p.hours, visibility: p.visibility, why: p.why,
  });
  const tiles = toTiles(places, config.tileStep);
  for (const [k, ps] of tiles) {
    writeFileSync(join(outDir, "tiles", `${k}.json.gz`), gzipSync(JSON.stringify(ps.map(entry))));
  }
  writeFileSync(join(outDir, "places.ndjson.gz"), gzipSync(places.map((p) => JSON.stringify(p)).join("\n")));
  writeFileSync(join(outDir, "id_map.json"), JSON.stringify(idMap));
  writeFileSync(
    join(outDir, "manifest.json"),
    JSON.stringify({ version: builtAt.slice(0, 10), builtAt, configVersion: config.version, sources: versions, bbox: bbox ?? null, count: places.length, tiles: tiles.size }, null, 2),
  );
  console.log(`built ${places.length} places in ${tiles.size} tiles → ${outDir} (${secs()}s)`);
}

main().catch((error) => fail(String(error?.stack ?? error)));
