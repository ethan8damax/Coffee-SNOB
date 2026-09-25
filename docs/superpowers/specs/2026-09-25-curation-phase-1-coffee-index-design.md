# Curation system, Phase 1: build the coffee index

**Date:** 2026-09-25 · **Parent spec:** `2026-09-25-curation-system-design.md`
(sections 3, 4, 5.1, 6.4 Phase 1) · **Status:** design

**Why:** one command that turns free open data into a deduped, filtered,
worldwide list of coffee places with stable ids, written as map tiles plus a
report. Nothing user-facing: Phase 2 serves the tiles. This phase ends when
a pilot city's output has been inspected by hand.

**Supersedes:** the 2026-09-23 map spec listed "bulk-importing OSM data" as
out of scope. The parent spec reverses that on purpose: the index is treated
as an ODbL database, kept apart from our own ratings and logs.

## What the sources actually look like (probed 2026-09-25)

Nothing is downloaded whole. Both sources are Parquet files on public cloud
storage; DuckDB reads only the columns and row groups a query needs.

| Source | Where | Coffee rows | Notes |
| --- | --- | --- | --- |
| Overture Places | `s3://overturemaps-us-west-2/release/<latest>/theme=places/type=place/*` (latest from `https://stac.overturemaps.org/catalog.json`) | measured in plan | Categories `coffee_shop`, `cafe`, `coffee_roastery`. Carries addresses with locality/region/country, `operating_status`, `confidence`, `brand.wikidata`, and a `sources` list. **Already merges Foursquare, Meta, Microsoft, AllThePlaces and BrightQuery records.** |
| OpenStreetMap via OSM US Layercake | `https://data.openstreetmap.us/layercake/pois.parquet` (4.7 GB, spatially sorted, freshness in `…/layercake/metadata.json`) | 676,366 worldwide (582,669 nodes); 361 in the Atlanta box | `amenity`, `cuisine[]`, `brand`, `brand:wikidata`, `opening_hours`, `website`, `phone`, `bbox`. No street address. Global coffee scan: ~2.5 min on a home connection; one city: ~2 s. |

**Change from the parent spec: no separate Foursquare feed.** FSQ OS Places
now needs a portal account and token, and Overture already contains
Foursquare's records (135 of Atlanta's coffee places cite Foursquare as a
source). Revisit only if Overture drops it.

## Package layout (`packages/coffee-index`)

Pure steps are plain functions with Vitest tests; only `extract` touches the
network.

- `config.json` — every tunable, versioned: categories, dedupe radius (50 m),
  name-similarity threshold, visibility weights and show threshold, 10%
  change alarm, tile step (0.1°).
- `src/extract.ts` — DuckDB (`@duckdb/node-api`, MIT) runs one coffee-only
  query per source, worldwide or inside `--bbox`, into
  `.cache/<source>-<version>.parquet`. A cached file for the same source
  version is reused.
- `src/normalize.ts` — both sources into one `SourcePlace`:
  `{ sourceId, name, lat, lng, address, locality, region, countryCode,
  website, phone, hours, category, brand, brandWikidata, closed }`.
  Source ids: `osm:node/123`, `osm:way/456` (the same form
  `shops.external_id` already uses, minus the prefix), `ov:<GERS id>`.
- `src/dedupe.ts` — bucket by ~50 m cells, compare neighbours, union-find.
  Merge when names are near-identical after `normalizeChainName`, or similar
  **and** website domain or phone digits match. When unsure, keep both.
  Field priority: OSM for hours; Overture for name, address, locality and
  country; otherwise first non-empty.
- `src/filter.ts` — drops non-coffee (`isCoffeePlace` on OSM-style tags;
  Overture's category maps to a `coffee_shop` cuisine), chains (`isChain`
  with name, brand and `brand:wikidata` from either source), and closed
  places (`operating_status = permanently_closed`). Overrides come in
  Phase 3.
- `src/visibility.ts` — parent spec 5.1, only the signals that exist now:
  +1 in 2+ sources, +1 primary category is `coffee_shop`, +1 has hours or a
  website. **Show** at ≥ 2, else **dim**. Roaster and flag signals land in
  Phases 3 and 5. `why` lists the signals that fired.
- `src/identity.ts` — `cs_<hash>` from the anchor source id (Overture GERS
  first, else OSM). Loads the previous `id_map.json` (source id → `cs_` id);
  a cluster containing any known source id keeps that old id. After the
  first build, refuses to run without the previous map (`--first-run`
  overrides).
- `src/tiles.ts` — gzipped JSON per 0.1° cell (the app's `snapToGrid`
  step), named `<minLat>_<minLng>.json.gz`, entries per parent spec 4.3.
- `src/report.ts` — counts by country, added/removed vs the previous
  build, suggested chains (names or brand IDs with > 10 locations in one
  country not on the blocklist), and the alarm: more than 10% of places
  appearing or vanishing fails the build.
- `src/build.ts` + `pnpm --filter @coffeesnob/coffee-index build-index
  [--bbox minLng,minLat,maxLng,maxLat] [--out dir] [--first-run]`.

Output directory (`out/<build-date>/`): `tiles/`, `id_map.json`,
`report.json`, `report.md`, `manifest.json`
(`{ version, builtAt, sources: { overture, layercake }, count }`).

## Inputs from Supabase

Only the chain blocklist, read with the public anon key
(`SUPABASE_URL`, `SUPABASE_ANON_KEY` env). If unreachable the build fails;
a chain-less index must never publish.

## Out of scope (later phases)

Hosting and upload, the monthly GitHub Actions schedule, and `id_map`
storage beside the tiles (Phase 2, once tile hosting is chosen);
`place_overrides`, flags, `chain_blocklist.status` (Phase 3); roasters
(Phase 5). Street addresses for OSM-only places (Layercake has an addresses
layer; only if the pilot shows it matters).

## Done when

- Unit tests cover normalize, dedupe (merge, near-miss, keep-both),
  filter, visibility, identity (inherit across builds, refuse without map)
  and the report alarm.
- A pilot build for the Atlanta box runs end to end; its report and a
  sample of its tiles are checked against what we know is there (Spiller
  Park, East Pole, Muchacho present; Starbucks, Kung Fu Tea absent; no
  obvious double dots).
- A second pilot build keeps every `cs_` id from the first.
- A worldwide build runs locally; runtime and output size are recorded in
  the tracker.
