# Curation system, Phase 2: serve the coffee index

**Date:** 2026-09-25 · **Parent spec:** `2026-09-25-curation-system-design.md`
(sections 4.1 step 6, 4.2, 4.4, 6.4 Phase 2) · **Phase 1 results:** tracker,
2026-09-25 · **Status:** design

**Why:** the map's unrated dots come from live Overpass today: ~12 s cold,
and the public server goes down. Phase 2 serves the Phase 1 index as static
files from a CDN, behind a switch, so a map open costs a few small cached
files. Search's slow OSM stage moves to the index too.

## Decisions (owner, 2026-09-25)

- **Hosting: Cloudflare R2** (free storage to 10 GB, free egress). Public
  bucket; the app reaches it through a rewrite on the site
  (`coffeesnobproject.com/coffee-index/*` → the bucket's public URL), so
  Vercel's CDN caches it and there is one URL to change if hosting moves.
  The domain's DNS stays at GoDaddy.
- **Switch:** `EXPO_PUBLIC_COFFEE_INDEX_URL`. Set → the map and search use
  the index. Unset → today's Overpass path, unchanged. Production stays
  unset until the ODbL review the parent spec asks for (open question 1).
  The Overpass route is deleted in a follow-up once the switch is on in
  production and has run for a week.

## Changes to Phase 1 output

The build's output folder becomes exactly what is uploaded:

```
manifest.json                       ← root pointer, short cache
v/<version>/manifest.json           ← { version, tileStep, splitStep, searchStep, split: [keys] }
v/<version>/tiles/<key>.json        ← 0.1° cells (gzip bytes, Content-Encoding: gzip)
v/<version>/tiles-fine/<key>.json   ← 0.025° cells, only inside split cells
v/<version>/search/<key>.json       ← 1° cells: [[id, name, lat, lng], …]
v/<version>/places.ndjson.gz        ← the full index: the ODbL download
v/<version>/id_map.json, report.md, report.json
```

- **Dense cells split.** A 0.1° cell with more than `splitAbove` (1000)
  places is written as sixteen 0.025° cells instead; its key goes in the
  version manifest's `split` list. 107 of 97k cells worldwide (Ho Chi Minh
  City's largest: 10k places, 811 KB → ~50 KB per fine cell).
- **Search files per 1° cell, not per country.** The US alone would be a
  ~2 MB download before the first result. A 3×3 block of 1° cells around
  the searcher covers a metro and its suburbs (today's Overpass stage
  searches ~110 km). Rows are `[id, name, lat, lng]`.
- Every versioned file is immutable (`Cache-Control: public, max-age=31536000,
  immutable`); the root manifest is `max-age=300`. A new build uploads its
  whole version folder first and swaps the root manifest last.

## Monthly build (GitHub Actions)

`.github/workflows/coffee-index.yml`: monthly (the 25th, after Overture's
release) plus manual dispatch. Steps: pnpm install → read the root manifest
and download the live version's `id_map.json` and `places.ndjson.gz` as
`--prev` (none yet → `--first-run`) → build → `aws s3 sync` the version
folder with gzip/JSON/cache headers → upload the root manifest → delete
versions older than the previous one. A build alarm (>10% churn) fails the
job and publishes nothing.

Secrets: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

## App

- `lib/map/coffee-index.ts`: loads the root and version manifests once per
  session; `tileKeys(box)` → 0.1° keys, expanded to 0.025° keys for split
  cells; fetches tiles with an in-memory cache; maps entries to
  `NearbyShopPin` with `externalId = cs_…`, `sourceIds`, `visibility`.
- `useNearbyMapData` picks the index or Overpass by the switch. Same
  padding, grid and zoom limit as today.
- **Dim dots only close in:** dim places are dropped from the map and list
  unless the view spans less than 0.05° (a neighbourhood). Show places
  appear at every zoom the map already allows.
- **One dot per shop across id schemes:** `dropRatedDuplicates` also
  matches a rated shop's `external_id` (`node/123`) against an index dot's
  source ids (`osm:node/123`).
- **Search stage 3** uses the index search files instead of the Overpass
  name search: fetch the 3×3 1° cells around the searcher, keep rows whose
  name contains every query word.
- **Logging an index dot:** `logVisit` for a new shop first looks for an
  existing `shops` row by the dot's `cs_` id or any legacy source id
  (`node/123`); if found, the log goes to that shop. Otherwise
  `log_shop_visit` creates it with `p_external_id = cs_…`. No SQL change.

## Site

- `next.config.ts` rewrite `/coffee-index/:path*` → `COFFEE_INDEX_ORIGIN`
  (the R2 public URL, env). Absent → no rewrite.
- Data sources page adds Overture Maps Foundation (CDLA Permissive 2.0,
  with Foursquare OS Places, Apache 2.0, inside it) and a download link
  for the current index (`places.ndjson.gz`, ODbL) — shown only when the
  index is configured.

## Local development

`pnpm --filter @coffeesnob/coffee-index serve out/<build>` serves a build
folder with the same headers (gzip, CORS), so the app can run against a
real build with `EXPO_PUBLIC_COFFEE_INDEX_URL=http://localhost:8787`.

## Done when

- Unit tests: split keys, search file rows, tile-key expansion, entry
  mapping, dim filtering, cross-scheme duplicate drop, search matching,
  existing-shop lookup before create.
- With a local worldwide build: Atlanta shows index dots with no Overpass
  request; the Ho Chi Minh City view loads fine tiles; a rated shop shows
  once; searching "muchacho" and "east pole" finds them; logging an index
  dot for an already-rated OSM shop adds to that shop.
- Atlanta compared against Overpass (counts, obvious misses) and recorded.
- Workflow file in place; first real publish happens once R2 exists.

## Out of scope

Overrides, flags, `active_place_hides` (Phase 3); "why it's here" copy
(with Phase 3's report buttons); deleting the Overpass route (follow-up
after the switch is on in production).
