import { existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { config } from "./config";
import type { OsmRow, OvertureRow } from "./place";

// The only network code in the index build. DuckDB reads just the columns
// and row groups a query needs from each source's remote Parquet, so a
// worldwide coffee extract moves a small slice of each dataset. Each extract
// is cached per source version, so reruns are local.
export type BBox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

const LAYERCAKE = "https://data.openstreetmap.us/layercake";
const OVERTURE_STAC = "https://stac.overturemaps.org/catalog.json";

export async function sourceVersions(): Promise<{ layercake: string; overture: string }> {
  const [lc, ov] = await Promise.all([
    fetch(`${LAYERCAKE}/metadata.json`).then((r) => r.json() as Promise<{ timestamp: string }>),
    fetch(OVERTURE_STAC).then((r) => r.json() as Promise<{ latest: string }>),
  ]);
  return { layercake: lc.timestamp, overture: ov.latest };
}

const bboxSql = (b: BBox | undefined) =>
  b ? ` and bbox.xmin >= ${b.minLng} and bbox.xmax <= ${b.maxLng} and bbox.ymin >= ${b.minLat} and bbox.ymax <= ${b.maxLat}` : "";
const bboxTag = (b: BBox | undefined) => (b ? `-${b.minLng}_${b.minLat}_${b.maxLng}_${b.maxLat}` : "-world");
const sqlList = (xs: string[]) => xs.map((x) => `'${x.replace(/'/g, "''")}'`).join(", ");

async function cached<T>(cacheDir: string, file: string, query: string): Promise<T[]> {
  mkdirSync(cacheDir, { recursive: true });
  const path = join(cacheDir, file);
  const db = await DuckDBInstance.create(":memory:");
  const c = await db.connect();
  // Worldwide copies are big: don't buffer rows just to keep their order,
  // and cap memory so the build fits on a laptop or a CI runner.
  await c.run("install httpfs; load httpfs; set s3_region='us-west-2'; set preserve_insertion_order=false; set memory_limit='3GB';");
  if (!existsSync(path)) {
    const tmp = `${path}.tmp`;
    await c.run(`copy (${query}) to '${tmp}' (format parquet)`);
    renameSync(tmp, path); // only a finished extract becomes the cache
  }
  const reader = await c.runAndReadAll(`select * from '${path}'`);
  return reader.getRowObjectsJson() as unknown as T[];
}

export function extractOsm(version: string, cacheDir: string, bbox?: BBox): Promise<OsmRow[]> {
  return cached<OsmRow>(cacheDir, `osm-${version.replace(/:/g, "")}${bboxTag(bbox)}.parquet`, `
    select type, id, name[1] as name, amenity, cuisine, brand, "brand:wikidata" as brand_wikidata,
      opening_hours, website, phone,
      (bbox.ymin + bbox.ymax) / 2 as lat, (bbox.xmin + bbox.xmax) / 2 as lng
    from read_parquet('${LAYERCAKE}/pois.parquet')
    where (amenity = 'cafe' or list_contains(cuisine, 'coffee_shop'))${bboxSql(bbox)}`);
}

export function extractOverture(release: string, cacheDir: string, bbox?: BBox): Promise<OvertureRow[]> {
  return cached<OvertureRow>(cacheDir, `overture-${release}${bboxTag(bbox)}.parquet`, `
    select id, names."primary" as name, taxonomy."primary" as category, operating_status,
      websites[1] as website, phones[1] as phone,
      brand.wikidata as brand_wikidata, brand.names."primary" as brand_name,
      addresses[1].freeform as address, addresses[1].locality as locality,
      addresses[1].region as region, addresses[1].country as country,
      list_transform(sources, s -> s.dataset) as datasets,
      (bbox.ymin + bbox.ymax) / 2 as lat, (bbox.xmin + bbox.xmax) / 2 as lng
    from read_parquet('s3://overturemaps-us-west-2/release/${release}/theme=places/type=place/*')
    where (taxonomy."primary" in (${sqlList(config.overtureCategories)}) or basic_category in ('coffee_shop', 'cafe'))${bboxSql(bbox)}`);
}
