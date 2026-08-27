# Marketing Site Truthful Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/web` show only real data and honest "coming soon" states — no fabricated cities, no fictional journal content live, no dead-end stub forms — per `docs/superpowers/specs/2026-08-26-marketing-site-truthful-launch-design.md`.

**Architecture:** Two data-truthfulness fixes against the live Supabase project (removing demo data that's actually live in production, and a content-draft flag flip), a shared query function so the homepage stops using hardcoded fake city lists and instead reads the same live data `city-guides` already reads, and a real Resend-backed signup endpoint replacing a client-only stub.

**Tech Stack:** Next.js 15 App Router (Server Components), Supabase (`@coffeesnob/supabase` workspace package), Resend (via Vercel Marketplace), vitest (existing convention in `packages/supabase`).

---

## Task 1: Remove the live demo Lisbon data from the real database

`supabase/seed.sql` has already been run against the real, shared Supabase project (project ref `kyiuhuivyugoqljqodil`, name "Coffee SNOB") — there is no separate dev database. Verified directly against it: `lisbon` / `status: demo` / 7 shops is live right now, and `/city-guides/lisbon` on the deployed site is rendering it as if it were a real published guide. Editing `seed.sql` alone would not fix this — it only runs again on a local `db reset`. This needs an actual migration applied to the live project.

**Files:**
- Create: `supabase/migrations/0007_remove_demo_lisbon.sql`
- Create: `supabase/seed.dev.sql`
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Apply the migration to the live Supabase project**

Use the Supabase MCP tool (the same mechanism migrations 0001–0005 were applied with — there's no `supabase/config.toml` in this repo, so the CLI workflow isn't set up here):

```
mcp__plugin_supabase_supabase__apply_migration
  project_id: kyiuhuivyugoqljqodil
  name: remove_demo_lisbon
  query: delete from public.cities where slug = 'lisbon';
```

The `shops`, `lists`, and `list_items` foreign keys to `cities` are all `on delete cascade` (see `supabase/migrations/0001_core.sql` and `0002_lists.sql`), so this one delete removes all 7 Lisbon shops, the Lisbon city-guide list, and its list_items too.

- [ ] **Step 2: Verify the deletion**

```
mcp__plugin_supabase_supabase__execute_sql
  project_id: kyiuhuivyugoqljqodil
  query: select slug, status from public.cities order by slug;
```

Expected: 9 rows (`atlanta`, `austin`, `london`, `nashville`, `new-york`, `portland`, `san-francisco`, `seattle`, `tampa`), no `lisbon` row. (Atlanta/Nashville/London were added in a separate migration, `0006_add_priority_launch_cities.sql`, applied earlier in this session — already live, nothing to do here.)

- [ ] **Step 3: Save the deleted Lisbon content as a dev-only fixture**

Create `supabase/seed.dev.sql` with this content (the exact block being removed from `seed.sql` in Step 4 — copy it verbatim, don't retype):

```sql
-- Dev-only fixture. NOT run against production. Lisbon is not a real
-- launch market — this gives local development real-shaped data to render
-- (a full city guide, 7 shops) without it ever being live. Load manually
-- against a local/dev Supabase instance if you need it:
--   psql "$DEV_DATABASE_URL" -f supabase/seed.dev.sql

insert into public.cities (slug, name, country, region, status) values
  ('lisbon', 'Lisbon', 'Portugal', 'Europe', 'demo');

with lisbon as (select id from public.cities where slug = 'lisbon')
insert into public.shops (city_id, name, neighborhood, price_tier, tag, writeup, order_note, editorial_rating)
select lisbon.id, s.name, s.neighborhood, s.price_tier, s.tag, s.writeup, s.order_note, s.editorial_rating
from lisbon, (values
  ('Noi Coffee', 'Príncipe Real', '€€', 'Espresso bar',
   'The best-run bar in the country. Two grinders, one Ethiopian on filter, and a barista who will ask what you drank yesterday. Order at the counter and stay standing.',
   'Filter — whatever is newest', 5::smallint),
  ('Fábrica Coffee Roasters', 'Baixa', '€€', 'Roaster',
   'Roasts in the back, sells across the counter, and does not pretend the room is anything other than a workshop. The cortado is the control sample.',
   'Cortado, plus a bag of the Colombian', 4::smallint),
  ('Copenhagen Coffee Lab', 'Príncipe Real', '€€', 'Filter focus',
   'Nordic import that made light roast normal here. Bright, consistent, occasionally too full to sit. The pastry is better than it needs to be.',
   'V60, single origin', 4::smallint),
  ('Olisipo Roastery', 'Alcântara', '€€€', 'Roaster',
   'A working roastery with a cupping table open to the public on Fridays. Ask about the Brazilian naturals if the door is open.',
   'Whatever is on the cupping table', 4::smallint),
  ('Café Graça', 'Graça', '€', 'Neighbourhood',
   'Not a specialty room and not trying to be. Good beans, old tiles, three tables outside facing the wrong way for the view — which is the point.',
   'Espresso, one sugar, standing', 3::smallint),
  ('Tartine Baixa', 'Baixa', '€€', 'Bakery bar',
   'Coffee is a strong second act to the bread. Reroute if you are already walking past; do not plan a morning around it.',
   'Flat white and the sourdough', 3::smallint),
  ('Comoba', 'Cais do Sodré', '€€', 'All-day',
   'Pleasant, busy, and fine. The kitchen is the reason to come; the coffee follows the room rather than leading it.',
   'Breakfast, coffee incidental', 2::smallint)
) as s(name, neighborhood, price_tier, tag, writeup, order_note, editorial_rating);

with lisbon as (select id from public.cities where slug = 'lisbon')
insert into public.lists (type, slug, title, description, body, city_id, save_count)
select
  'city_guide',
  'lisbon',
  'Lisbon',
  'Eleven years of tiled cafés and a new generation that learned to roast light.',
  'Lisbon drinks more coffee per head than almost anywhere in Europe and, until recently, drank it badly on purpose — dark, cheap, and standing up. The habit survived; the beans changed. A handful of rooms opened in the last decade that roast light, weigh doses, and still sell an espresso for a euro twenty at the counter.

This guide covers seven shops we drank at more than once, across four neighbourhoods. The verdicts are ours, nobody paid to be here, and the ones we left out were left out on purpose.',
  lisbon.id,
  0
from lisbon;

with l as (select id from public.lists where slug = 'lisbon'),
     ordered as (
       select s.id, s.name,
         row_number() over (
           order by array_position(
             array['Noi Coffee','Fábrica Coffee Roasters','Copenhagen Coffee Lab','Olisipo Roastery','Café Graça','Tartine Baixa','Comoba'],
             s.name
           )
         ) as pos
       from public.shops s
       join public.cities c on c.id = s.city_id
       where c.slug = 'lisbon'
     )
insert into public.list_items (list_id, shop_id, position)
select l.id, ordered.id, ordered.pos from l, ordered;
```

- [ ] **Step 4: Remove the Lisbon block from `supabase/seed.sql`**

Edit `supabase/seed.sql`: delete everything from the `-- Demo content only.` comment through the final `insert into public.list_items` statement (the block now duplicated in `supabase/seed.dev.sql`). The file should end after the real-cities `insert into public.cities` statement.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0007_remove_demo_lisbon.sql supabase/seed.dev.sql supabase/seed.sql
git commit -m "Remove live demo Lisbon data; move fixture to seed.dev.sql

The Lisbon demo city/shops/guide were live in production, not just a local
fixture, since seed.sql had already been run against the real Supabase
project. Deleted for real via migration; kept as an explicit dev-only file
for local testing."
```

---

## Task 2: Flip the draft flag on the one live placeholder journal post

**Files:**
- Modify: `apps/web/content/journal/nobody-roasts-for-the-second-cup.mdx`

Of the 7 files in `apps/web/content/journal/`, 6 already have `draft: true` (from `scripts/generate-journal-stubs.mjs`) and are already excluded by `getAllJournalPosts()` in `apps/web/lib/journal.ts`. Only this one file is missing that flag, and it's confirmed placeholder copy from the design phase.

- [ ] **Step 1: Add the draft flag**

In `apps/web/content/journal/nobody-roasts-for-the-second-cup.mdx`, change the frontmatter from:

```
---
title: "Nobody roasts for the second cup"
category: "Roasters"
author: "Mara Kessler"
date: "2026-08-16"
readMinutes: 9
photoAlt: "Roaster at the drum, Alcântara garage — morning light through a roll-up door"
dek: "Ana Beires roasts forty kilos a week in an Alcântara garage and is sold out by Thursday. We spent a morning watching her reject three lots in a row."
---
```

to:

```
---
title: "Nobody roasts for the second cup"
category: "Roasters"
author: "Mara Kessler"
date: "2026-08-16"
readMinutes: 9
photoAlt: "Roaster at the drum, Alcântara garage — morning light through a roll-up door"
dek: "Ana Beires roasts forty kilos a week in an Alcântara garage and is sold out by Thursday. We spent a morning watching her reject three lots in a row."
draft: true
---
```

(Only the frontmatter changes — leave the body prose in place; it's kept on disk as a style/format reference for writing real posts.)

- [ ] **Step 2: Verify**

```bash
pnpm --filter web dev
```

Visit `http://localhost:3000/journal` — expect no featured post and no "Everything else" grid (both sections are conditionally rendered on `posts.length`, per `apps/web/app/journal/page.tsx`). This is the motivating gap Task 3 fixes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/content/journal/nobody-roasts-for-the-second-cup.mdx
git commit -m "Mark the one live journal post as draft — confirmed placeholder copy"
```

---

## Task 3: Add a real empty state to the journal index

**Files:**
- Modify: `apps/web/app/journal/page.tsx`

- [ ] **Step 1: Add the empty state**

In `apps/web/app/journal/page.tsx`, after the `pagehead` section and before the `{featured && (...)}` block, add:

```tsx
      {posts.length === 0 && (
        <section className="wrap" style={{ padding: "clamp(40px,8vw,72px) 0" }}>
          <p className="lede">First letter's still being written. Sign up below and it'll land in your inbox the day it's ready — nothing before then.</p>
        </section>
      )}
```

The full function should now read:

```tsx
export default function JournalIndexPage() {
  const posts = getAllJournalPosts();
  const [featured, ...rest] = posts;

  return (
    <div className="snob-web">
      <WebNav active="Journal" />
      <section className="pagehead">
        <div className="wrap pagehead-in">
          <div>
            <Eyebrow>Journal</Eyebrow>
            <h1 className="h1">Reported from<br />the <em>counter</em></h1>
          </div>
          <p className="lede">Roaster interviews, rooms worth sitting in, and what we learned drinking our way through a city. Everything here was paid for by us, and nothing here was placed.</p>
        </div>
      </section>
      {posts.length === 0 && (
        <section className="wrap" style={{ padding: "clamp(40px,8vw,72px) 0" }}>
          <p className="lede">First letter's still being written. Sign up below and it'll land in your inbox the day it's ready — nothing before then.</p>
        </section>
      )}
      {featured && (
        <section className="jfeat wrap">
          <div className="photo-ph" data-label={featured.frontmatter.photoAlt} style={{ aspectRatio: "4/3" }} />
          <div>
            <span className="label jkicker">{featured.frontmatter.category}</span>
            <Link href={`/journal/${featured.slug}`}><h2 className="h2">{featured.frontmatter.title}</h2></Link>
            <p className="lede" style={{ marginTop: 16 }}>{featured.frontmatter.dek}</p>
            <div className="byline" style={{ marginTop: 24 }}>
              <Avatar name={featured.frontmatter.author} size={26} />
              <span className="label bl-name">{featured.frontmatter.author}</span>
              <span className="bl-dot" />
              <span className="label bl-meta">{featured.frontmatter.readMinutes} min</span>
            </div>
          </div>
        </section>
      )}
      {rest.length > 0 && (
        <section className="jindex">
          <div className="wrap">
            <div className="sec-head"><h2 className="h2" style={{ marginTop: 0 }}>Everything else</h2></div>
            <div className="pgrid">
              {rest.map((p) => (
                <article key={p.slug} className="pcard">
                  <Link href={`/journal/${p.slug}`} className="pcard-link">
                    <div className="photo-ph pcard-photo" data-label={p.frontmatter.photoAlt} />
                    <span className="label pcard-kicker">{p.frontmatter.category}</span>
                    <h3 className="d2 pcard-title">{p.frontmatter.title}</h3>
                    <p className="body pcard-dek">{p.frontmatter.dek}</p>
                  </Link>
                  <div className="pcard-foot">
                    <span className="label pcard-author">{p.frontmatter.author}</span>
                    <span className="label pcard-meta">{p.frontmatter.readMinutes} min</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
      <LetterBand />
      <WebFooter />
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter web dev
```

Visit `http://localhost:3000/journal` — expect the empty-state message to render where the featured post used to be, and the `LetterBand` signup still below it.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/journal/page.tsx
git commit -m "Add real empty state to journal index instead of silently rendering nothing"
```

---

## Task 4: Add a shared `getCitiesWithShopCounts` query, refactor city-guides to use it

The homepage (Task 5) needs the exact same "cities with real shop counts" data that `apps/web/app/city-guides/page.tsx` already fetches inline. Extracting it into `packages/supabase` (where every other Supabase query already lives, per `packages/supabase/src/queries.ts`) avoids duplicating the join logic in two Next.js pages.

**Files:**
- Modify: `packages/supabase/src/queries.ts`
- Modify: `packages/supabase/src/index.ts`
- Test: `packages/supabase/test/queries.test.ts`
- Modify: `apps/web/app/city-guides/page.tsx`

- [ ] **Step 1: Write the failing test**

Add to `packages/supabase/test/queries.test.ts` (alongside the existing `describe("getCities", ...)` block — add the import too):

```ts
import { getCities, getCitiesWithShopCounts, getCityGuide, getProfile, isUsernameAvailable, saveIdentity, saveTastePicks } from "../src/queries";
```

```ts
describe("getCitiesWithShopCounts", () => {
  it("joins shop counts from published city guides onto each city", async () => {
    const client = {
      from: (table: string) => {
        if (table === "cities") {
          return {
            select: () => ({
              order: () => Promise.resolve({
                data: [
                  { id: "c1", slug: "lisbon", name: "Lisbon", country: "Portugal", region: "Europe", status: "demo" },
                  { id: "c2", slug: "tampa", name: "Tampa", country: "United States", region: "North America", status: "coming_soon" },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === "lists") {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                data: [{ city_id: "c1", list_items: [{ count: 7 }] }],
                error: null,
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as any;

    const cities = await getCitiesWithShopCounts(client);
    expect(cities).toEqual([
      { id: "c1", slug: "lisbon", name: "Lisbon", country: "Portugal", region: "Europe", status: "demo", shopCount: 7 },
      { id: "c2", slug: "tampa", name: "Tampa", country: "United States", region: "North America", status: "coming_soon", shopCount: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm --filter @coffeesnob/supabase test
```

Expected: FAIL — `getCitiesWithShopCounts is not a function` (or a TS error naming the same thing).

- [ ] **Step 3: Implement it**

Add to `packages/supabase/src/queries.ts`, after `getCities`:

```ts
export async function getCitiesWithShopCounts(client: Client) {
  const cities = await getCities(client);

  const { data: guides, error } = await client
    .from("lists")
    .select("city_id, list_items(count)")
    .eq("type", "city_guide");
  if (error) throw error;

  const shopCountByCity = new Map<string, number>();
  for (const guide of guides) {
    const count = (guide.list_items as unknown as { count: number }[])[0]?.count ?? 0;
    shopCountByCity.set(guide.city_id as string, count);
  }

  return cities.map((c) => ({ ...c, shopCount: shopCountByCity.get(c.id) ?? 0 }));
}
```

Export it from `packages/supabase/src/index.ts` — change:

```ts
export { getCities, getCityGuide, getProfile, isUsernameAvailable, saveIdentity, saveTastePicks } from "./queries";
```

to:

```ts
export { getCities, getCitiesWithShopCounts, getCityGuide, getProfile, isUsernameAvailable, saveIdentity, saveTastePicks } from "./queries";
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @coffeesnob/supabase test
```

Expected: PASS.

- [ ] **Step 5: Refactor `city-guides/page.tsx` to use the shared function**

In `apps/web/app/city-guides/page.tsx`, replace:

```tsx
import { getSupabase } from "@/lib/supabase";
import { getCities } from "@coffeesnob/supabase";

export const revalidate = 60;

async function getCityGuidesIndex() {
  const supabase = getSupabase();
  const cities = await getCities(supabase);

  const { data: guides, error: guidesError } = await supabase
    .from("lists")
    .select("city_id, list_items(count)")
    .eq("type", "city_guide");
  if (guidesError) throw guidesError;

  const shopCountByCity = new Map<string, number>();
  for (const guide of guides) {
    const count = (guide.list_items as unknown as { count: number }[])[0]?.count ?? 0;
    shopCountByCity.set(guide.city_id as string, count);
  }

  return cities.map((c) => ({
    ...c,
    shops: shopCountByCity.get(c.id) ?? 0,
    href: c.status === "live" || c.status === "demo" ? `/city-guides/${c.slug}` : undefined,
  }));
}
```

with:

```tsx
import { getSupabase } from "@/lib/supabase";
import { getCitiesWithShopCounts } from "@coffeesnob/supabase";

export const revalidate = 60;

async function getCityGuidesIndex() {
  const supabase = getSupabase();
  const cities = await getCitiesWithShopCounts(supabase);

  return cities.map((c) => ({
    ...c,
    shops: c.shopCount,
    href: c.status === "live" || c.status === "demo" ? `/city-guides/${c.slug}` : undefined,
  }));
}
```

(The rest of the file — `CityGuidesPage`, the JSX using `c.shops` and `c.href` — is unchanged; this only moves the join query itself.)

- [ ] **Step 6: Verify**

```bash
pnpm --filter web typecheck
pnpm --filter web dev
```

Visit `http://localhost:3000/city-guides` — expect the same output as before (6 cities, all "Not yet mapped", no Lisbon after Task 1).

- [ ] **Step 7: Commit**

```bash
git add packages/supabase/src/queries.ts packages/supabase/src/index.ts packages/supabase/test/queries.test.ts apps/web/app/city-guides/page.tsx
git commit -m "Extract getCitiesWithShopCounts into @coffeesnob/supabase, reuse in city-guides"
```

---

## Task 5: Rewrite the homepage to use real city data

**Files:**
- Modify: `apps/web/app/page.tsx`

The homepage's `US_CITIES`, `EU_CITIES`, and `GUIDE_CITIES` constants list cities (Brooklyn, Chicago, Berlin, Copenhagen, Milan, etc.) that were never real launch markets, plus a fabricated "+22 more." `GUIDE_CITIES` also hardcodes a `detour` rating per city that was never backed by real data (there's no city-level aggregate rating in the schema — only per-shop `editorial_rating`). This task removes all of it in favor of the same live query `city-guides/page.tsx` uses.

- [ ] **Step 1: Replace the top of the file**

Replace:

```tsx
import Link from "next/link";
import { Eyebrow, DETOUR, DETOUR_SUB } from "@/components/primitives";
import { WebNav, LetterBand, WebFooter } from "@/components/web-chrome";
import { SignupForm } from "@/components/signup-form";

const US_CITIES = ["Portland", "Brooklyn", "Chicago", "Oakland", "Austin", "Seattle", "Los Angeles"];
const EU_CITIES = ["Lisbon", "Berlin", "Copenhagen", "Paris", "Milan", "Barcelona", "Rotterdam"];

const JOURNAL_TEASERS = [
  { kicker: "Roasters", title: "Nobody roasts for the second cup", dek: "Ana Beires roasts forty kilos a week in an Alcântara garage and is sold out by Thursday.", photoLabel: "Roaster at the drum, Alcântara garage" },
  { kicker: "Rooms", title: "The case for a bad chair", dek: "Four rooms we keep going back to, none of them comfortable.", photoLabel: "Wooden stool at a tiled counter" },
  { kicker: "Field notes", title: "Three days in Porto, one good espresso", dek: "A bar culture that resists everything specialty coffee wants from it.", photoLabel: "Porto café interior" },
];

const GUIDE_CITIES = [
  { city: "Lisbon", country: "Portugal", shops: 7, detour: 5, href: "/city-guides/lisbon" },
  { city: "Portland", country: "United States", shops: 0, detour: 0, href: undefined },
  { city: "Seattle", country: "United States", shops: 0, detour: 0, href: undefined },
  { city: "Austin", country: "United States", shops: 0, detour: 0, href: undefined },
];
```

with:

```tsx
import Link from "next/link";
import { Eyebrow, DETOUR, DETOUR_SUB } from "@/components/primitives";
import { WebNav, LetterBand, WebFooter } from "@/components/web-chrome";
import { SignupForm } from "@/components/signup-form";
import { getSupabase } from "@/lib/supabase";
import { getCitiesWithShopCounts } from "@coffeesnob/supabase";

export const revalidate = 60;

type CityWithShopCount = Awaited<ReturnType<typeof getCitiesWithShopCounts>>[number];
```

(`JOURNAL_TEASERS` is deleted — the `Journal` component below is rewritten in a later step to read real posts instead.)

- [ ] **Step 2: Rewrite `CityBand` to take real cities as a prop**

Replace:

```tsx
function CityBand() {
  const cities = [...US_CITIES.slice(0, 5), ...EU_CITIES.slice(0, 5)];
  return (
    <section className="cityband">
      <div className="cityband-in">
        <span className="label" style={{ color: "var(--oxblood)", flexShrink: 0 }}>Mapped at launch</span>
        <ul className="citylist">
          {cities.map((c) => (
            <li key={c}><Link href={c === "Lisbon" ? "/city-guides/lisbon" : "/city-guides"} className="d4">{c}</Link></li>
          ))}
          <li className="more"><Link href="/city-guides" className="d4">+ 22 more</Link></li>
        </ul>
      </div>
    </section>
  );
}
```

with:

```tsx
function CityBand({ cities }: { cities: CityWithShopCount[] }) {
  return (
    <section className="cityband">
      <div className="cityband-in">
        <span className="label" style={{ color: "var(--oxblood)", flexShrink: 0 }}>Mapped at launch</span>
        <ul className="citylist">
          {cities.map((c) => (
            <li key={c.slug}>
              {c.status === "live" || c.status === "demo"
                ? <Link href={`/city-guides/${c.slug}`} className="d4">{c.name}</Link>
                : <span className="d4">{c.name}</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

(No fake "+N more" — with 9 real launch cities, all of them fit; if the real city count ever exceeds what looks good in one row, add pagination back then, against the real count.)

- [ ] **Step 3: Rewrite `Guides` to take real cities as a prop**

Replace:

```tsx
function Guides() {
  return (
    <section className="guides" style={{ padding: "clamp(56px,12vw,104px) 0 0" }}>
      <div className="wrap">
        <div className="sec-head">
          <Eyebrow>City guides</Eyebrow>
          <div className="sec-head-row">
            <h2 className="h2">One guide per city,<br />written on the ground.</h2>
            <Link href="/city-guides" className="seeall label-lg">All city guides →</Link>
          </div>
        </div>
        <div className="ggrid">
          {GUIDE_CITIES.map((c) => (
            <Link key={c.city} className="gcard" href={c.href ?? "/city-guides"}>
              <div className="photo-ph gphoto" data-label={`${c.city} — street or counter photograph`} />
              <div className="gline">
                <h3 className="d3">{c.city}</h3>
                <span className="label gcountry">{c.country}</span>
              </div>
              <div className="gmeta">
                <span className="body-sm">{c.shops ? <><span className="num">{c.shops}</span> shops</> : "Guide in progress"}</span>
                {c.detour > 0 && <span className="body-sm gbu"><span className="num">{c.detour}</span> worth the detour</span>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
```

with:

```tsx
function Guides({ cities }: { cities: CityWithShopCount[] }) {
  const featured = cities.slice(0, 4);
  return (
    <section className="guides" style={{ padding: "clamp(56px,12vw,104px) 0 0" }}>
      <div className="wrap">
        <div className="sec-head">
          <Eyebrow>City guides</Eyebrow>
          <div className="sec-head-row">
            <h2 className="h2">One guide per city,<br />written on the ground.</h2>
            <Link href="/city-guides" className="seeall label-lg">All city guides →</Link>
          </div>
        </div>
        <div className="ggrid">
          {featured.map((c) => {
            const href = c.status === "live" || c.status === "demo" ? `/city-guides/${c.slug}` : "/city-guides";
            return (
              <Link key={c.slug} className="gcard" href={href}>
                <div className="photo-ph gphoto" data-label={`${c.name} — street or counter photograph`} />
                <div className="gline">
                  <h3 className="d3">{c.name}</h3>
                  <span className="label gcountry">{c.country}</span>
                </div>
                <div className="gmeta">
                  <span className="body-sm">{c.shopCount > 0 ? <><span className="num">{c.shopCount}</span> shops</> : "Guide in progress"}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

(The fabricated per-city `detour` number is dropped entirely — there's no real aggregate to show yet.)

- [ ] **Step 4: Rewrite `Journal` to read real posts**

Replace:

```tsx
function Journal() {
  return (
    <section className="journal" style={{ padding: "clamp(56px,12vw,104px) 0" }}>
      <div className="wrap">
        <div className="sec-head">
          <Eyebrow>The journal</Eyebrow>
          <div className="sec-head-row">
            <h2 className="h2">What we are writing<br />while we build.</h2>
            <Link href="/journal" className="seeall label-lg">All writing →</Link>
          </div>
        </div>
        <div className="jgrid">
          {JOURNAL_TEASERS.map((a) => (
            <article key={a.title} className="jcard">
              <div className="photo-ph cr jphoto" data-label={a.photoLabel} />
              <span className="label jkicker">{a.kicker}</span>
              <h3 className="d3">{a.title}</h3>
              <p className="body">{a.dek}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
```

with (importing `getAllJournalPosts` at the top of the file alongside the other imports):

```tsx
function Journal() {
  const posts = getAllJournalPosts().slice(0, 3);
  if (posts.length === 0) return null;
  return (
    <section className="journal" style={{ padding: "clamp(56px,12vw,104px) 0" }}>
      <div className="wrap">
        <div className="sec-head">
          <Eyebrow>The journal</Eyebrow>
          <div className="sec-head-row">
            <h2 className="h2">What we are writing<br />while we build.</h2>
            <Link href="/journal" className="seeall label-lg">All writing →</Link>
          </div>
        </div>
        <div className="jgrid">
          {posts.map((p) => (
            <Link key={p.slug} href={`/journal/${p.slug}`} className="jcard">
              <div className="photo-ph cr jphoto" data-label={p.frontmatter.photoAlt} />
              <span className="label jkicker">{p.frontmatter.category}</span>
              <h3 className="d3">{p.frontmatter.title}</h3>
              <p className="body">{p.frontmatter.dek}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
```

Add the import at the top of the file: `import { getAllJournalPosts } from "@/lib/journal";`

(With 0 live posts after Task 2, this section renders nothing at all on the homepage right now — that's correct; it reappears automatically the day a real post ships.)

- [ ] **Step 5: Wire the page component to fetch real data**

Replace:

```tsx
export default function LandingPage() {
  return (
    <div className="snob-web">
      <WebNav />
      <Hero />
      <CityBand />
      <Scale />
      <Guides />
      <Journal />
      <Founder />
      <LetterBand />
      <WebFooter />
    </div>
  );
}
```

with (the `Founder` section is removed here — see Task 6 for why):

```tsx
export default async function LandingPage() {
  const supabase = getSupabase();
  const cities = await getCitiesWithShopCounts(supabase);

  return (
    <div className="snob-web">
      <WebNav />
      <Hero />
      <CityBand cities={cities} />
      <Scale />
      <Guides cities={cities} />
      <Journal />
      <LetterBand />
      <WebFooter />
    </div>
  );
}
```

- [ ] **Step 6: Verify**

```bash
pnpm --filter web typecheck
pnpm --filter web dev
```

Visit `http://localhost:3000/` — expect the "Mapped at launch" band to show all 9 real cities (no Brooklyn/Berlin/etc., no "+22 more"), the city-guide cards to show "Guide in progress" for all 4 featured, and no journal section (0 live posts).

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "Rewrite homepage to read real city and journal data instead of hardcoded lists"
```

---

## Task 6: Remove the Founder section — don't ship plausible-sounding fiction

**Files:**
- Modify: `apps/web/app/page.tsx`

The current "Why this exists" section is literally `"Placeholder — rewrite this in your own voice"` with a "Your name" byline — already honest about being unfinished. But per the truthfulness constraint, drafting *replacement* prose that sounds like a real founder story (a trip, a shop, a name) and shipping it live would be worse: a reader would take it as true. The right fix is to not render this section until there's real copy to put there, not to fill it with plausible-sounding placeholder narrative.

- [ ] **Step 1: Delete the `Founder` function**

Remove this entire function from `apps/web/app/page.tsx`:

```tsx
function Founder() {
  return (
    <section style={{ background: "var(--card)", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)", padding: "clamp(56px,12vw,96px) clamp(20px,7vw,56px)" }}>
      <div style={{ maxWidth: 660, margin: "0 auto" }}>
        <Eyebrow color="var(--ink-3)">Why this exists</Eyebrow>
        <div style={{ marginTop: 32, display: "grid", gap: 20 }}>
          <p className="lede">Placeholder — rewrite this in your own voice. Two or three paragraphs on the trip that started it, the shop you still think about, and what was missing from every app you tried to plan it with.</p>
          <p className="body">Placeholder. Say who Snob is for and who it is not for. Being specific here is what makes people sign up.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 44, paddingTop: 28, borderTop: "1px solid var(--rule)" }}>
          <div className="photo-ph" style={{ width: 56, height: 56, borderRadius: "50%" }} data-label="Portrait" />
          <div>
            <div className="d4">Your name</div>
            <div className="label" style={{ color: "var(--ink-3)", marginTop: 6 }}>Founder, Coffee Snob</div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

(`<Founder />` was already removed from `LandingPage`'s JSX in Task 5, Step 5 — this step just deletes the now-unused function so it isn't dead code.)

- [ ] **Step 2: Note where it goes when real**

Add this comment where the function used to live, so a future edit doesn't have to rediscover the reasoning:

```tsx
// A "Why this exists" founder section belongs here once there's a real
// story to tell — see docs/superpowers/specs/2026-08-26-marketing-site-truthful-launch-design.md.
// Structure to follow (from the deleted draft): (1) the trip/shop that
// started it, (2) who Snob is for and isn't, (3) a real name and photo.
// Don't ship placeholder narrative that reads as true.
```

- [ ] **Step 3: Verify**

```bash
pnpm --filter web typecheck
```

Expected: no errors (confirms no other reference to `Founder` remains).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "Remove fabricated founder story instead of leaving placeholder narrative live"
```

---

## Task 7: Add an honest "the app is coming" section

**Files:**
- Modify: `apps/web/app/page.tsx`

No CSS file changes needed — this reuses the existing color-agnostic
`.letter-in` grid layout (`display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:end`,
confirmed in `apps/web/app/globals.css`) and sets its own background/text
color inline, the same way the existing `Scale` component in this file
already does (`style={{ background: "var(--oxblood)", color: "var(--cream)" }}`).
Note `.letter-h{color:var(--ink)}` is tuned specifically for `LetterBand`'s
`--burnt` background — reusing it here on an oxblood background would put
dark ink text on a dark red background, so this section deliberately does
NOT use the `letter-h`/`letter` classes, only `letter-in` for layout.

- [ ] **Step 1: Add the section component**

Add to `apps/web/app/page.tsx`, after the `Journal` function:

```tsx
function AppComingSoon() {
  return (
    <section style={{ background: "var(--oxblood)", color: "var(--cream)", padding: "96px 0 100px" }}>
      <div className="wrap letter-in">
        <div>
          <Eyebrow color="rgba(233,228,208,.5)">The app</Eyebrow>
          <h2 className="h2" style={{ marginTop: 18 }}>Built for<br />wherever you land.</h2>
        </div>
        <div className="letter-form">
          <p className="lede on-dark">The locator is in build — city guides, the detour scale, saved lists, all of it. No download link yet because there's nothing to download yet. The letter is how you'll know the day it's ready.</p>
          <SignupForm dark done={["You'll hear it from us first", "No spam between now and launch — just the Sunday letter."]} />
        </div>
      </div>
    </section>
  );
}
```

(`Eyebrow`'s color and `.lede.on-dark` match the exact values `Scale` already uses for text-on-oxblood in this same file — grep `on-dark` in `apps/web/app/globals.css` if you need to confirm the class exists; it's already used by `Scale`'s `<p className="lede on-dark">`.)

- [ ] **Step 2: Add it to the page**

In `LandingPage` (from Task 5), insert it between `Journal` and `LetterBand`:

```tsx
      <Journal />
      <AppComingSoon />
      <LetterBand />
```

- [ ] **Step 3: Verify**

```bash
pnpm --filter web typecheck
pnpm --filter web dev
```

Visit `http://localhost:3000/` — expect a second dark (oxblood) band above the Sunday-letter (burnt) one, with its own signup form, readable cream text, and no fake app-store badges/links.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "Add honest 'app is coming' section instead of no app CTA at all"
```

---

## Task 8: Wire the signup form to Resend

**Files:**
- Create: `apps/web/app/api/newsletter/route.ts`
- Modify: `apps/web/components/signup-form.tsx`
- Modify: `apps/web/package.json`
- Modify: `apps/web/.env.local`

- [ ] **Step 1: Provision Resend (manual — needs the user directly)**

Decided against the Vercel Marketplace integration: it only offers paid plans ($20/mo Pro minimum), while signing up at resend.com directly gets the free tier (3k emails/mo). This step needs a human at the keyboard, not an autonomous agent — it touches account/DNS state:

1. Sign up at resend.com (free tier).
2. Add and verify a sending domain (DNS records — TXT/CNAME — added at the domain registrar).
3. Create an API key in the Resend dashboard.
4. Create an Audience named "Coffee Snob Newsletter" and copy its Audience ID.
5. Add both secrets to Vercel directly (run these yourself so the values never pass through an agent's context):

```bash
vercel env add RESEND_API_KEY
# paste the API key when prompted, for all environments
vercel env add RESEND_AUDIENCE_ID
# paste the Audience ID when prompted, for all environments
vercel env pull --yes
```

- [ ] **Step 2: Add placeholder env var names locally**

`apps/web/.env.local` currently has:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

After Step 1's `vercel env pull --yes`, it should also contain `RESEND_API_KEY` and `RESEND_AUDIENCE_ID` — verify both are present (`grep RESEND apps/web/.env.local`) rather than adding them by hand, so the real values pulled from Vercel aren't overwritten with blanks.

- [ ] **Step 3: Install the Resend SDK**

```bash
pnpm add resend --filter web
```

- [ ] **Step 4: Write the route handler**

Create `apps/web/app/api/newsletter/route.ts`:

```ts
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const { email } = await request.json();
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { error } = await resend.contacts.create({
    email,
    audienceId: process.env.RESEND_AUDIENCE_ID!,
  });
  if (error) {
    return NextResponse.json({ error: "Could not subscribe" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Wire the form to call it**

Replace `apps/web/components/signup-form.tsx` in full:

```tsx
"use client";

import { useState } from "react";

export function SignupForm({
  dark = false, placeholder = "you@email.com", cta = "Get the letter", done,
}: { dark?: boolean; placeholder?: string; cta?: string; done?: [string, string] }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");

  if (status === "sent") {
    return (
      <div className={`signed ${dark ? "on-dark" : ""}`} aria-live="polite">
        <span className="label-lg">{done ? done[0] : "You're on the list"}</span>
        <p className="body">{done ? done[1] : "First letter lands Sunday. Nothing else until then."}</p>
      </div>
    );
  }

  return (
    <form
      className={`signup ${dark ? "on-dark" : ""}`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!email.trim()) return;
        setStatus("loading");
        const res = await fetch("/api/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        setStatus(res.ok ? "sent" : "error");
      }}
    >
      <input
        type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder} aria-label="Email address" disabled={status === "loading"}
      />
      <button type="submit" className="btn btn-bu" disabled={status === "loading"}>
        {status === "loading" ? "Sending…" : cta}
      </button>
      {status === "error" && <p className="body-sm" role="alert">Something went wrong — try again in a minute.</p>}
    </form>
  );
}
```

(The `ponytail:` stub comment is gone because this is no longer a stub.)

- [ ] **Step 6: Verify**

```bash
pnpm --filter web typecheck
pnpm --filter web dev
```

Submit the form at `http://localhost:3000/` with a real email address you can check, then confirm in the Resend dashboard that the contact was added to the "Coffee Snob Newsletter" audience.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/api/newsletter/route.ts apps/web/components/signup-form.tsx apps/web/package.json pnpm-lock.yaml apps/web/.env.local
git commit -m "Wire newsletter signup to Resend instead of a client-only stub"
```

(`.env.local` is typically gitignored — check `git status` before this `add`; if it's ignored, drop it from the command. Never commit real API keys if `.env.local` somehow isn't ignored.)

---

## Explicitly skipped (from the spec, deliberately not built here)

- **`<AffiliateLink>` MDX component + FTC disclosure** (spec's affiliate infrastructure section): there are currently zero live journal posts and no affiliate program signed up yet, so there's nothing for this component to attach to. Build it alongside the first real gear-focused journal post, not speculatively now.
- **Verifying the "Letter № 001" claim** in the hero copy: flagged in the spec for the user to confirm directly, not something to guess at in code.

## Self-review notes

- Every task's "Files" section lists exact paths; no task references a function/type not defined earlier in this plan (`getCitiesWithShopCounts` is defined in Task 4 before Tasks 5 uses it; `AppComingSoon` is defined and used in the same task).
- Task 1 is the only task touching the live database — sequenced first so later local-dev verification (Tasks 3, 5, 7) reflects the corrected data.
