# Coffee Snob — Project Setup Design

Date: 2026-08-21

## Context

Coffee Snob is a specialty coffee discovery and social app — curated city guides
(5–10 shops per city, editorial standards, not crowdsourced), a Letterboxd-style
personal log/rating system (the five-step "detour scale," never numeric scores),
and social features (friends, collections). Brand voice: "It's okay to be a snob."
Full product/brand context lives in `coffee-snob-*.md` (voice, curation standards,
write-up guide) — not duplicated here.

A visual design for the product (marketing site + app screens) already exists in
a Claude Design project ("Coffee Snob", project id
`019df027-97af-74d2-a376-2a823fc1ddc5`). Its `github.md` file shows it was
originally synced up from a real Next.js (App Router) repo — this design work is
an iteration on that codebase's look, not a from-scratch mockup. The design
project's own files (`.jsx` screens, `.html` pages) are Claude Design's live-preview
format (React-via-CDN, `window.*` globals) — they are the **visual/content
reference**, not code to import verbatim. `styles.css` / `web.css` are plain CSS
with custom properties and semantic class names (no Tailwind, no CSS-in-JS) and
are directly portable.

This spec covers standing up the real project: repo structure, tech stack,
content model, and backend schema. It does not cover the full implementation
(that's the next step, via a written plan) or long-term product roadmap.

## Decisions

**Two products, one repo.**
- A **Next.js marketing site** (landing, city guides, journal) — fast, SEO-first,
  deployed to Vercel.
- An **Expo (React Native) app** — the actual product (discovery, map, shop, log,
  collections, onboarding, account, profile) — shipping to iOS and Android via the
  App Store/Play Store, and also exporting to web via `react-native-web`, so the
  same codebase covers "download the app" and "use it on the website."

Both live in one Turborepo monorepo at `ethan8damax/Snob` (existing repo,
contents fully overwritten). Same Vercel project, repointed to build `apps/web`
out of the monorepo.

**Repo layout:**
```
apps/
  web/        Next.js 15 App Router, TypeScript — marketing site + journal + city guides
  app/        Expo + Expo Router, TypeScript — product app (iOS/Android/web)
packages/
  design-tokens/  Shared colors, type scale, spacing — ported from styles.css/web.css
  supabase/       Shared Supabase client, generated TS types, query helpers
supabase/
  migrations/     SQL schema
  seed/           Launch-city seed data
```

**Content model** — three distinct kinds of content, deliberately not unified:

| Content | Where it lives | Why |
|---|---|---|
| Journal (magazine articles: roaster interviews, field notes) | MDX files in `apps/web/content/journal/*.mdx`, git-versioned | Website-only, no app screen consumes it. This is the SEO-blogging surface — full control over meta tags and static generation matters more here than queryability. |
| City guides (one per city, editorial, structured: neighborhoods + ordered shop list + long-form write-up) | Supabase (`lists` table, `type='city_guide'`) | Needed by **both** the website (City Guides pages) and the app (in-app guide reader screen) — has to be queryable at runtime, can't be a git file. |
| Collections (freeform themed shop lists, editorial or user-made) | Supabase (`lists` table, `type='collection'`) | Same shape as city guides — an ordered list of shops with a curator, title, and save count — just not scoped to one city. |

City guides and collections share a table because they're the same underlying
shape; a `type` column and (for city guides) a `city_id` foreign key are what
distinguish them.

**Supabase schema (initial):**
- `profiles` — id, username, avatar, taste picks (from onboarding)
- `cities` — name, country, region, slug, status (`live` / `coming_soon`)
- `shops` — city_id, name, neighborhood, lat/lng, price tier, tags, sourcing/roaster
  notes, the 60–90 word editorial write-up, the official 1–5 detour verdict
- `lists` — type (`city_guide`/`collection`), title, curator_id (nullable = "the
  desk"/editorial), city_id (nullable, city_guide only), cover photo, long-form body
- `list_items` — list_id, shop_id, position, note (ordered stops)
- `logs` — user_id, shop_id, rating (1–5), note, visited_at (personal check-ins)
- `list_saves` — user_id, list_id (bookmarks / save counts)
- `follows` — follower_id, followee_id (friends graph)

Auth: Supabase Auth — email/password + Sign in with Apple + Google (Apple requires
Sign in with Apple if any other social login is offered).

RLS: public read on published content (`cities`, `shops`, `lists`, `list_items`);
user-scoped read/write on `profiles`, `logs`, `list_saves`, `follows`;
editorial-only write on `shops`/`lists`/`list_items`.

Backend targets the user's existing Supabase project (keys to be provided when
implementing); Vercel env vars need repointing from the old Supabase project to
this one.

**Design system port:** colors, type scale (Area typeface — Normal 400/700,
Extended 700/900), and spacing extracted from the design project's `styles.css`/
`web.css`/`_primitives.jsx` into `packages/design-tokens`, consumed by both apps
(web as CSS custom properties, native via `react-native-svg` for icons and the
chevron "detour" rating mark).

**This session's build order** (explicitly chosen over building both apps in
parallel, or scaffolding plumbing before any real content):
1. Monorepo skeleton — both apps building and deployable, minimal content
2. Supabase schema — migrations + seed data for the 6 launch cities against the
   user's existing project
3. Design tokens extracted into `packages/design-tokens`
4. Marketing site built out for real: Landing, City Guides (index + detail),
   Journal (index + post), wired to Supabase (city guides) and MDX (journal),
   deployed to Vercel
5. Expo app: navigation shell + stub screens only (full screen-by-screen visual
   port is future work, not this pass)

## Out of scope for this pass

- Full visual port of every Expo app screen (discovery, map, shop, log, etc.) —
  scaffolded only.
- App Store / Play Store submission (icons, store listing, EAS build config).
- Social/OAuth provider setup (Apple/Google developer console configuration) —
  schema supports it, provider registration is separate follow-up work.
- Search, recommendations, or any ranking logic beyond editorial ordering.
