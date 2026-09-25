# Curation Phase 0: Groundwork Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the chain/coffee filters into a new `@coffeesnob/coffee-index` package, lock the TS and SQL chain matchers together with one shared fixture test, move data credits to a public page on the marketing site, and trim the app's credit lines.

**Architecture:** A plain-TS workspace package (same shape as `packages/supabase`) that `apps/web` imports. The SQL twin is exercised in Vitest through PGlite (Postgres in WASM) loading the newest `is_chain_name` definition straight from `supabase/migrations/`. The credits page is a static Next.js page in `apps/web`.

**Tech Stack:** pnpm + Turborepo, TypeScript, Vitest 2, `@electric-sql/pglite` (dev), Next.js 15 App Router, Expo/react-native-web.

Spec: `docs/superpowers/specs/2026-09-25-curation-phase-0-groundwork-design.md`.

---

## File map

- Create `packages/coffee-index/{package.json,tsconfig.json,src/index.ts}` — the moved filters.
- Create `packages/coffee-index/test/filters.test.ts` — moved `isCoffeePlace`/`isChain`/`normalizeChainName` tests.
- Create `packages/coffee-index/test/fixtures/chains.json` + `test/chain-twins.test.ts` — shared TS/SQL fixture test.
- Modify `apps/web/lib/nearby-shops.ts` (drop moved code), `apps/web/lib/nearby-shops.test.ts` (drop moved tests), `apps/web/lib/{photon,chain-blocklist,chain-lookup}.ts`, `apps/web/app/api/nearby-shops/route.ts`, `apps/web/app/(admin)/admin/(dashboard)/shops/page.tsx`, `apps/web/package.json`, `apps/web/next.config.ts`, `packages/supabase/src/queries.ts` (comment).
- Create `apps/web/app/data-sources/page.tsx`; modify `apps/web/components/web-chrome.tsx` (footer link).
- Modify `apps/app/components/shop/parts.tsx`, `apps/app/components/map/basemap.ts`, `apps/app/components/map/basemap.test.ts`.
- Modify `docs/v1-launch-tracker.md`.

---

### Task 1: Create the package with the moved filters

**Files:**
- Create: `packages/coffee-index/package.json`, `packages/coffee-index/tsconfig.json`, `packages/coffee-index/src/index.ts`, `packages/coffee-index/test/filters.test.ts`

- [ ] **Step 1: package.json**

```json
{
  "name": "@coffeesnob/coffee-index",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: tsconfig.json** (copy of `packages/supabase/tsconfig.json` plus JSON imports)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

Add `"@types/node": "^22.10.2"` to devDependencies (the twins test reads migration files).

- [ ] **Step 3: Move the tests first.** Cut the `describe("isCoffeePlace"…)`, `describe("isChain"…)` and the `normalizeChainName` test blocks out of `apps/web/lib/nearby-shops.test.ts` into `packages/coffee-index/test/filters.test.ts`, with header:

```ts
import { describe, it, expect } from "vitest";
import { isChain, normalizeChainName, isCoffeePlace } from "../src";
```

In `nearby-shops.test.ts`, change the import to `import { toNearbyShop, buildOverpassQuery } from "./nearby-shops";`.

- [ ] **Step 4: Run to see it fail**

Run: `pnpm install && pnpm --filter @coffeesnob/coffee-index test`
Expected: FAIL — cannot resolve `../src`.

- [ ] **Step 5: Move the code.** Cut from `apps/web/lib/nearby-shops.ts` everything from the `// OSM files bubble tea shops…` comment through the end of `isCoffeePlace`, and from `// Chain filter (chain_blocklist…` to the end of the file. Paste into `packages/coffee-index/src/index.ts` under this header, unchanged otherwise:

```ts
// Shared coffee/chain filters. Used by the web app's map and search today and
// by the monthly coffee index build later (docs/superpowers/specs/
// 2026-09-25-curation-system-design.md).
```

In the pasted `isChain` comment, keep `Keep in step with public.is_chain_name (supabase/migrations/0024).` and add `test/chain-twins.test.ts enforces it.`

- [ ] **Step 6: Run to see it pass**

Run: `pnpm --filter @coffeesnob/coffee-index test && pnpm --filter @coffeesnob/coffee-index typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/coffee-index apps/web/lib/nearby-shops.ts apps/web/lib/nearby-shops.test.ts pnpm-lock.yaml
git commit -m "coffee-index: move chain and coffee filters into their own package"
```

### Task 2: Point the web app at the package

**Files:** `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/lib/photon.ts`, `apps/web/lib/chain-blocklist.ts`, `apps/web/lib/chain-lookup.ts`, `apps/web/app/api/nearby-shops/route.ts`, `apps/web/app/(admin)/admin/(dashboard)/shops/page.tsx`, `packages/supabase/src/queries.ts`

- [ ] **Step 1:** `apps/web/package.json` dependencies: add `"@coffeesnob/coffee-index": "workspace:*"`. `next.config.ts`: `transpilePackages: ["@coffeesnob/coffee-index", "@coffeesnob/design-tokens", "@coffeesnob/supabase"]`.
- [ ] **Step 2:** Rewrite imports:
  - `photon.ts`: `import { isChain, isCoffeePlace, type ChainEntry } from "@coffeesnob/coffee-index";`
  - `chain-blocklist.ts`: `import type { ChainEntry } from "@coffeesnob/coffee-index";`
  - `chain-lookup.ts`: `import { normalizeChainName } from "@coffeesnob/coffee-index";`
  - `route.ts`: `import { buildOverpassQuery, toNearbyShop, type OverpassElement } from "@/lib/nearby-shops";` plus `import { isChain, isCoffeePlace } from "@coffeesnob/coffee-index";`
  - admin shops page: `import { normalizeChainName } from "@coffeesnob/coffee-index";`
  - `queries.ts:1034` comment: `(see packages/coffee-index/src/index.ts)`.
- [ ] **Step 3: Verify**

Run: `pnpm install && pnpm typecheck && pnpm test && pnpm --filter web build`
Expected: all pass; `grep -rn "isChain\|isCoffeePlace\|normalizeChainName" apps/web/lib/nearby-shops.ts` prints nothing.

- [ ] **Step 4: Commit** — `git commit -am "web: import filters from @coffeesnob/coffee-index"` (plus lockfile).

### Task 3: Shared TS/SQL chain fixture test

**Files:**
- Create: `packages/coffee-index/test/fixtures/chains.json`, `packages/coffee-index/test/chain-twins.test.ts`
- Modify: `packages/coffee-index/package.json` (devDependency `@electric-sql/pglite`)

- [ ] **Step 1: Fixture**

```json
{
  "blocklist": [
    { "name": "starbucks", "wikidata": "Q37158" },
    { "name": "costa", "wikidata": "Q608845" },
    { "name": "dunkin", "wikidata": null },
    { "name": "caribou coffee", "wikidata": null },
    { "name": "the coffee bean tea leaf", "wikidata": null }
  ],
  "cases": [
    { "name": "Starbucks", "isChain": true },
    { "name": "STARBUCKS", "isChain": true },
    { "name": "Starbucks Reserve", "isChain": false },
    { "name": "Starbucksy Roasters", "isChain": false },
    { "name": "Not Starbucks", "isChain": false },
    { "name": "Costa", "isChain": true },
    { "name": "Costa Rica Café", "isChain": false },
    { "name": "Dunkin'", "isChain": true },
    { "name": "Dunkin' Donuts", "isChain": true },
    { "name": "Dunkin Donuts Express", "isChain": true },
    { "name": "Dunkinville Coffee", "isChain": false },
    { "name": "Caribou Coffee", "isChain": true },
    { "name": "The Coffee Bean & Tea Leaf", "isChain": true },
    { "name": "Spiller Park Coffee", "isChain": false },
    { "name": "", "isChain": false }
  ]
}
```

- [ ] **Step 2: Test**

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { isChain, type ChainEntry } from "../src";
import fixture from "./fixtures/chains.json";

// isChain (TS) and public.is_chain_name (SQL) are twins: the map filters with
// one, log_shop_visit and shop_ratings with the other. Same fixture, both
// sides, so a rule change to one without the other fails here.
const blocklist = fixture.blocklist as ChainEntry[];
const MIGRATIONS = join(__dirname, "../../../supabase/migrations");

// The newest definition wins in production, so test that one.
function latestIsChainName(): string {
  const re = /create (or replace )?function public\.is_chain_name\b[\s\S]*?\$\$;/gi;
  const defs = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .flatMap((f) => readFileSync(join(MIGRATIONS, f), "utf8").match(re) ?? []);
  if (!defs.length) throw new Error("no is_chain_name definition found in supabase/migrations");
  return defs[defs.length - 1];
}

describe("chain matcher twins", () => {
  const db = new PGlite();
  beforeAll(async () => {
    await db.exec("create table public.chain_blocklist (name text primary key, wikidata text);");
    await db.exec(latestIsChainName());
    for (const c of blocklist) {
      await db.query("insert into public.chain_blocklist (name, wikidata) values ($1, $2)", [c.name, c.wikidata]);
    }
  });

  it.each(fixture.cases)("isChain: $name → $isChain", ({ name, isChain: want }) => {
    expect(isChain({ name }, blocklist)).toBe(want);
  });

  it.each(fixture.cases)("is_chain_name: $name → $isChain", async ({ name, isChain: want }) => {
    const { rows } = await db.query<{ v: boolean }>("select public.is_chain_name($1) as v", [name]);
    expect(rows[0].v).toBe(want);
  });
});
```

Note: `isChain({ name: "" })` filters out the empty name and returns false; SQL `''` normalizes to `''`, which matches no entry — both false.

- [ ] **Step 3: Install and run**

Run: `pnpm --filter @coffeesnob/coffee-index add -D @electric-sql/pglite && pnpm --filter @coffeesnob/coffee-index test`
Expected: PASS, 30 twin cases. If any case differs between sides, that is a real drift — stop and report it rather than editing the fixture to hide it.

- [ ] **Step 4: Prove it catches drift.** Temporarily change `n.startsWith(c.name + " ")` to `n.startsWith(c.name)` in `src/index.ts`; run tests; expect `Starbucksy Roasters`/`Dunkinville Coffee` to fail on the TS side only. Revert.

- [ ] **Step 5: Commit** — `git add packages/coffee-index pnpm-lock.yaml && git commit -m "coffee-index: shared TS/SQL chain fixture test"`

### Task 4: Data sources page on the marketing site

**Files:** Create `apps/web/app/data-sources/page.tsx`; modify `apps/web/components/web-chrome.tsx`.

- [ ] **Step 1: Page** (copy per `apps/web/PRODUCT.md`: short, specific, no selling)

```tsx
import type { Metadata } from "next";
import { Eyebrow } from "@/components/primitives";
import { WebNav, WebFooter } from "@/components/web-chrome";

export const metadata: Metadata = {
  title: "Data sources · Coffee Snob",
  description: "Where the map's cafés, basemap and search come from.",
};

const SOURCES: { name: string; href: string; what: string; licence: string; licenceHref: string }[] = [
  {
    name: "OpenStreetMap",
    href: "https://www.openstreetmap.org",
    what: "Every café on the map, with its address, hours, website and phone.",
    licence: "© OpenStreetMap contributors, ODbL",
    licenceHref: "https://www.openstreetmap.org/copyright",
  },
  {
    name: "OpenFreeMap and OpenMapTiles",
    href: "https://openfreemap.org",
    what: "The basemap: streets, water and place names.",
    licence: "© OpenMapTiles, built from OpenStreetMap data",
    licenceHref: "https://www.openmaptiles.org/",
  },
  {
    name: "Photon by komoot",
    href: "https://photon.komoot.io",
    what: "The search box: cafés and cities by name, worldwide.",
    licence: "Search over OpenStreetMap data",
    licenceHref: "https://github.com/komoot/photon",
  },
];

export default function DataSourcesPage() {
  return (
    <div className="snob-web">
      <WebNav />
      <main>
        <section className="pagehead">
          <div className="wrap pagehead-in">
            <div>
              <Eyebrow>Data sources</Eyebrow>
              <h1 className="h1">Where the map<br />comes <em>from</em></h1>
            </div>
            <div>
              <p className="lede">The cafés, streets and search come from open data. The ratings, logs and write-ups are ours.</p>
            </div>
          </div>
        </section>
        <section className="wrap" style={{ paddingBlock: 48, display: "grid", gap: 32, maxWidth: 720 }}>
          {SOURCES.map((s) => (
            <div key={s.name}>
              <h2 className="h3"><a href={s.href}>{s.name}</a></h2>
              <p className="body">{s.what}</p>
              <p className="body-sm"><a href={s.licenceHref}>{s.licence}</a></p>
            </div>
          ))}
          <p className="body-sm">Something wrong with a café&apos;s details? Fix it on OpenStreetMap and the map picks it up.</p>
        </section>
      </main>
      <WebFooter />
    </div>
  );
}
```

Before writing: check `WebNav`'s props (`active` may be required) and that `h3`/`body` classes exist in `globals.css`; use the nearest existing classes if not.

- [ ] **Step 2: Footer link.** In `WebFooter`, add a second column: `["About", [["Data sources", "/data-sources"]]]`.
- [ ] **Step 3: Verify.** `pnpm --filter web typecheck && pnpm --filter web build`, then run `pnpm --filter web dev` and open `http://localhost:3000/data-sources` at 393px and 1440px; the footer link opens it.
- [ ] **Step 4: Commit** — `git commit -m "web: public Data sources page, linked from the footer"`

### Task 5: Trim the app's credit lines

**Files:** `apps/app/components/shop/parts.tsx:195,223`, `apps/app/components/map/basemap.ts`, `apps/app/components/map/basemap.test.ts`

- [ ] **Step 1: Failing test first.** Add to `basemap.test.ts`:

```ts
  it("links the credit to the public Data sources page", () => {
    expect(BASEMAP.attribution).toContain('href="https://coffeesnobproject.com/data-sources"');
  });
```

Run: `pnpm --filter app test -- basemap` → FAIL.

- [ ] **Step 2: Short credit.** In `basemap.ts`:

```ts
  // Short on purpose: ODbL and OpenMapTiles need a visible credit on the map;
  // the full list lives on the site's Data sources page.
  attribution:
    '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">&copy; OpenStreetMap</a> · ' +
    '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · ' +
    '<a href="https://coffeesnobproject.com/data-sources" target="_blank" rel="noopener">Sources</a>',
```

Run the test → PASS (all three BASEMAP tests).

- [ ] **Step 3: Shop page.** Delete the `<BodySm>Hours come from OpenStreetMap contributors.</BodySm>` and `<BodySm>Shop details © OpenStreetMap contributors.</BodySm>` lines. If `BodySm` is then unused in `parts.tsx`, drop it from the import.
- [ ] **Step 4: Verify.** `pnpm --filter app typecheck && pnpm --filter app test`. Run the app on web, open the map: the corner shows the short credit and "Sources" opens the site page; a shop page shows no credit lines.
- [ ] **Step 5: Commit** — `git commit -m "app: one short map credit linking to Data sources; drop shop-page credit lines"`

### Task 6: Tracker

- [ ] Add under Parked: `Curation system v2 (spec 2026-09-25): Phase 0 done; Phases 1–6 after launch.` and a Status log line: `- 2026-09-25 — Curation Phase 0: filters moved to packages/coffee-index; shared TS/SQL chain test (PGlite) guards the twins; credits moved to coffeesnobproject.com/data-sources, app keeps one short map credit.`
- [ ] Final check: `pnpm typecheck && pnpm test` at the root. Commit `Tracker: curation phase 0`.
