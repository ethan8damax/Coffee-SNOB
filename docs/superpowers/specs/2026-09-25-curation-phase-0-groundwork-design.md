# Curation system, Phase 0: groundwork

**Date:** 2026-09-25 · **Parent spec:** `2026-09-25-curation-system-design.md`
(section 6.4, Phase 0) · **Status:** approved 2026-09-25

**Why:** later phases build a monthly coffee index in its own package and
reuse the web app's chain and coffee filters there. This phase moves those
filters into that package, locks the TypeScript and SQL chain matchers
together with one shared test, and gives the data credits one public home.
No migrations. The map and search behave exactly as they do today.

## 1. `packages/coffee-index`

- New workspace package `@coffeesnob/coffee-index`, same shape as
  `packages/supabase` (`main`/`types` → `src/index.ts`, `test` = Vitest,
  `typecheck` = `tsc --noEmit`).
- `src/index.ts` holds `normalizeChainName`, `isCoffeePlace`, `isChain` and
  `ChainEntry`, moved unchanged from `apps/web/lib/nearby-shops.ts`, with
  their tests.
- `apps/web/lib/nearby-shops.ts` keeps only the Overpass pieces
  (`buildOverpassQuery`, `toNearbyShop`, types); Phase 2 deletes it.
  `photon.ts`, `chain-blocklist.ts`, `chain-lookup.ts`, the admin shops page
  and the `nearby-shops` route import from the package. Comments that point
  at `apps/web/lib/nearby-shops.ts` for the chain rule (migrations are left
  alone; `packages/supabase/src/queries.ts`) point at the package.
- `apps/web` adds the package to `dependencies` and `transpilePackages`.
- No tunables config file yet. It arrives in Phase 1 with the first thing
  that reads it.

## 2. Shared chain test (TypeScript ↔ SQL)

- `packages/coffee-index/test/fixtures/chains.json`: one small blocklist
  (`{ name, wikidata }`, some with an ID, some name-only) and cases
  `{ name, isChain }`. Cases cover case/apostrophe/accents, leading-word
  matches, ID-backed exact-only ("Costa Rica Café" vs "costa"), and
  near-misses ("Starbucksy", "Not Starbucks").
- TS test: each case through `isChain({ name }, blocklist)`.
- SQL test: PGlite (`@electric-sql/pglite`, dev dependency, Apache-2.0/
  PostgreSQL licence) in Vitest. It creates `public.chain_blocklist (name,
  wikidata)`, loads the **newest** `create or replace function
  public.is_chain_name` block found in `supabase/migrations/` (so later
  migrations are tested automatically), inserts the fixture blocklist, and
  checks every case.
- Only name matching is shared: `is_chain_name()` takes a name, not OSM
  brand tags. ID-by-tag matching stays covered by the TS-only tests.
- Runs in plain `pnpm test`; no network, no Docker, no production database.

## 3. Data sources page (marketing site)

- `apps/web/app/data-sources/page.tsx`, static, in the site's existing
  chrome, linked from the site footer.
- Credits what is in use today: OpenStreetMap contributors (ODbL, link to
  osm.org/copyright), OpenFreeMap and OpenMapTiles (basemap), Photon by
  komoot (search). One line that our ratings, logs and write-ups are our own.
- Foursquare OS Places, Overture and the index download are added when
  Phases 1–2 put them in use, not before.
- Copy follows `apps/web/PRODUCT.md`.

## 4. App: fewer credit lines

- Remove the two credit lines on the shop page
  (`apps/app/components/shop/parts.tsx`: "Hours come from OpenStreetMap
  contributors.", "Shop details © OpenStreetMap contributors.").
- The map's corner credit stays (ODbL and the basemap terms require a
  visible credit on the map) but shrinks to one short line:
  `© OpenStreetMap · OpenMapTiles · Sources`, where "Sources" opens
  `https://coffeesnobproject.com/data-sources`. `basemap.test.ts` keeps
  checking both names.

## Done when

- `pnpm test` and `pnpm typecheck` pass at the root, including the shared
  fixture run against both `isChain` and `is_chain_name()`.
- Changing either matcher's rule without the other fails the shared test.
- `/data-sources` renders on the site and the footer links to it.
- The shop page shows no credit lines; the map shows the short credit and
  its "Sources" link opens the site page.
- Tracker Status line added.

## Out of scope

Migrations, `chain_blocklist.status` (Phase 3), the config file (Phase 1),
any change to map or search behaviour.
