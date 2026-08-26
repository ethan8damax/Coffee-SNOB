# Map & Admin Dashboard Design

Date: 2026-08-26

## Context

Two related gaps surfaced together: the app's map tab is a literal
`"Map (not yet built)"` stub with no map SDK installed, and shop/city data
currently only gets into Supabase by hand-editing `supabase/seed.sql` — no
tooling exists for adding a shop day-to-day. The "amazing mockup and POC"
referenced in this brainstorm is confirmed to be the Claude Design visual
mockup (styled comp), not a working map integration — there is no existing
map code or SDK choice to build on, this is a fresh technical decision.

Both are addressed here because the admin dashboard is what will actually
populate the lat/lng data the map renders — building the map screen without
a real way to add shops would just mean testing it against seed data
forever.

## Decisions

### Map provider: Mapbox

Chosen over Google Maps and Apple-Maps-native-only because the app ships to
iOS, Android, *and* web (via `react-native-web`) from one codebase, and the
brand has a specific custom palette (oxblood/cream) the map needs to match
— Mapbox is the one provider where a single custom style (designed in
Mapbox Studio) renders identically across the native SDK and the web JS
library. Free tier (~50k map loads/month) comfortably covers launch scale;
Mapbox Geocoding (also free-tier) doubles as the address→lat/lng step in
the admin dashboard's shop form, so it's one vendor for both needs.

**Architecture:** `@rnmapbox/maps` for iOS/Android, `mapbox-gl` (via
`react-map-gl` for a cleaner React API) for web — these are different
packages with a shared interface exposed through Expo's platform-specific
file resolution (`MapView.native.tsx` / `MapView.web.tsx`, both implementing
the same small props contract: shops for the current city, selected shop,
`onSelectShop`). `apps/app/app/(tabs)/map.tsx` imports the platform-agnostic
`MapView` and doesn't know which implementation it got.

Designing the actual Mapbox Studio style (matching brand colors, custom pin
icons using the design system's chevron mark, hiding default POI clutter)
is a visual design task, not code — do it in Mapbox Studio directly, or via
the `impeccable` skill if browser-based iteration helps, before wiring the
style URL into either map package.

Mapbox access token: one public token (scoped, safe for client exposure per
Mapbox's own model) stored as an env var, added to both Vercel (web) and
EAS (native build) env config.

### Admin dashboard

**Where it lives:** `apps/web/app/(admin)/admin/*` — a route group in the
existing Next.js app, not a separate deployable app. Reuses the existing
Supabase client, design tokens, and hosting; avoids standing up a second
Vercel project for an internal tool two people use.

**Auth model:** a new `is_admin boolean not null default false` column on
`profiles`. Admins sign in through the same Supabase Auth used everywhere
else — no separate credential system. New RLS policies grant `insert` /
`update` / `delete` on `cities`, `shops`, `lists`, `list_items` to rows
where the requesting user's profile has `is_admin = true` (checked via a
`is_admin()` SQL function reading `auth.uid()`), replacing today's "no
write policy, service-role only" posture. This keeps admin writes on the
same RLS-governed path as everything else in Supabase, rather than
threading a service-role key through a web app's server environment.
Next.js middleware on the `(admin)` route group checks the session's
`is_admin` flag and redirects non-admins before any admin page renders.

**Scope (v1, all three confirmed in this session):**

1. **Cities/shops/lists CRUD** — the direct fix for hand-edited SQL. Shop
   form includes an "enter address → geocode" step (Mapbox Geocoding API)
   that fills lat/lng automatically instead of requiring them typed by
   hand. Lists (city guides/collections) get an ordered shop-picker for
   `list_items`.
2. **Moderation queue** — a page listing reported `logs` notes (per the v1
   moderation policy in `CONTENT-OPS.md`) with hide/remove actions. This
   replaces "review reports by hand via Supabase directly" now that a
   dashboard exists to put it in anyway.
3. **Affiliate/partner tracking** — a table (`partners`: shop_id, deal type,
   status, notes) and a simple list/edit view. Built ahead of having real
   partners or affiliate programs signed up yet, per the user's explicit
   request — kept intentionally simple (a record-keeping table, not an
   analytics integration) since there's no real performance data to surface
   until partnerships exist.

### Future: journal post management from the dashboard

Flagged by the user as wanted "eventually," not in this pass. Real
architectural tension worth naming now rather than glossing over: journal
posts are deliberately git-versioned MDX files
(`apps/web/content/journal/*.mdx`), chosen in the original project-setup
spec specifically for static-generation and meta-tag control. Editing them
from a web dashboard means either (a) a form that writes and commits MDX
files programmatically — unusual, puts git operations in the request path
of a web app — or (b) migrating journal content into Supabase like
lists/city-guides, which is simpler to build but gives up some of the
static-gen control that was the original reason to keep it as MDX. Not
resolved here; revisit when this becomes a real priority rather than a
"eventually."

## Data model changes

- `profiles.is_admin boolean not null default false`
- `is_admin()` SQL function + RLS policies on `cities`/`shops`/`lists`/
  `list_items` for insert/update/delete
- New `partners` table (shop_id, deal_type, status, notes, created_at)

## Sequencing note (added 2026-08-26, after this spec was written)

The admin dashboard is a net-new UI surface with no existing Claude Design
mockup — per the user's design-first workflow, it needs to be designed in
the Claude Design product before an implementation plan is written for it,
not designed ad hoc in code. **The backend decisions in this spec (RLS
model, `is_admin`, schema additions) are unaffected and can be built
first** — only the dashboard's actual pages/forms wait on the mockup. The
map screen's visual design likely already exists in the original "Coffee
Snob" Claude Design project (referenced in the project-setup spec) as part
of the app's screen set — verify that before assuming it also needs a
fresh mockup.

## Out of scope for this pass

- Designing the actual Mapbox Studio style (visual work, not this spec).
- Journal post editing from the dashboard (see "Future" above).
- Any real affiliate program integration or performance data — the
  `partners` table starts empty.
- Photo upload/gallery for shops or partner listings (moderation policy
  already defers photo upload generally).
