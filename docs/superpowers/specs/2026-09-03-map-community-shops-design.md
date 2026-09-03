# Map: Community Shops & Snob-Approval Pipeline — Design

Date: 2026-09-03

## Context

The prior `2026-08-26-map-and-admin-dashboard-design.md` spec chose Mapbox as
the map provider and scoped the admin dashboard, but assumed the map only
ever renders shops we've manually curated for a given city. This spec covers
a different idea: anyone should be able to open the map and see *any* nearby
coffee shop — not just Snob-Approved ones — with basic info (hours, address,
website), while the curated, editorially-vetted set continues to power city
guides. A shop earns a look for Snob-Approval once enough of our own users
have logged and rated it.

**Web scope, confirmed this session:** "get the app working on the web side
of things" means the existing Expo app's `react-native-web` build (per the
prior spec's cross-platform `MapView` architecture) — not a new, separate map
surface inside the `apps/web` marketing site. City-guides pages in
`apps/web` are unaffected by anything here.

**Design source of truth:** the "Coffee Snob" Claude Design project
(`019df027-97af-74d2-a376-2a823fc1ddc5`). Its existing `screens/map.jsx`
mockup embodied a stricter philosophy than this spec's starting idea —
city-list-only browsing, and an explicit refusal to show unrated shops
("we would rather show you nothing than show you guesses"). That mockup has
been **revised as part of this session** to fit the model below: it now
renders two pin layers (muted "nearby" dots for unrated shops, tiered pins
for rated ones) in every city, worldwide, with copy changes acknowledging
that unrated pins are always visible even where there's no Snob guide yet.
Pull the updated `screens/map.jsx` from that project before building the
real screen.

## Decisions

### Data source & query architecture: live OpenStreetMap, no bulk storage

Nearby shop data comes from OpenStreetMap via the Overpass API, queried live
by map viewport (bounding box) — never bulk-imported or cached wholesale.
There is no way to usefully store "every coffee shop in the world," so we
don't try. Requests route through a small proxy endpoint (a Next.js/Expo API
route) rather than hitting Overpass directly from the client: this avoids
CORS issues on the `react-native-web` build, gives one place to add a
short-lived cache (roughly 5–15 minutes per bounding-box tile) so panning
doesn't hammer the public Overpass instance, and keeps a single choke point
if the provider ever needs to change. Shop info surfaced: name, address,
lat/lng, `opening_hours`, website/phone where OSM has them — coverage is
inconsistent for small independents, which is expected, not a bug.

OSM was chosen over Google Places (requires a billing account even for the
free tier, stricter caching TOS) and Foursquare (smaller dataset, less
certain long-term free tier) specifically because our own promotion signal
comes from our users' logs, not the external source's rating — so OSM's lack
of a built-in review count/rating is not a blocker.

### Data model: one shop identity table, curation layered on top

`logs.shop_id` already has a single FK to `shops`, so this stays a single
identity space rather than splitting into a parallel table — that would mean
either a second nullable FK on `logs` with an XOR constraint, or a
polymorphic reference, for no real benefit given curated data only ever
comes from the two founders.

- **`shops`** (base identity, every shop we've ever touched): `id`,
  `external_id` (OSM node/way id — nullable, since an admin can add a shop
  directly without an OSM match; unique where not null, so two users logging
  the same real-world place dedupe onto one row), `name`, `lat`, `lng`,
  `city_id` (now nullable — a shop logged outside any launch city has no
  city), `neighborhood` (now nullable), `promotion_status text not null
  default 'none' check (in ('none', 'flagged', 'rejected'))`, `created_at`.
  A row here is created lazily — upserted on `external_id` — the first time
  anyone logs a visit to a shop that only existed as a live OSM result.
- **`shop_curations`** (the "Snob" layer): `shop_id` (PK, FK to `shops`),
  `writeup`, `editorial_rating`, `order_note`, `tag`, `price_tier`. A row
  existing here **is** what "Snob-Approved" means — no separate boolean or
  enum needed. City-guides pages become an inner join, `shops ⋈
  shop_curations where city_id = X`, which structurally can't leak
  unapproved shops in (there's no filter to forget).
- **`logs`**: unchanged. `shop_id` stays a single not-null FK — it already
  works for both curated and community shops once `shops` covers both.

Reviews (`logs` rows) are public exactly as they are today — the existing
`"logs are publicly readable"` RLS policy already covers this regardless of
whether the shop is curated.

### Promotion pipeline: our own users' logs, not the external rating

A trigger on `logs` insert: whenever a log is added for a shop with
`promotion_status = 'none'`, recompute that shop's log count and average
rating; if count ≥ threshold and average ≥ rating threshold, flip
`promotion_status` to `'flagged'`. Defaults: **5 logs minimum, average
rating ≥ 4.2** — deliberately low, since this only means "worth a human
visit," not an approval bar. The actual bar stays the two-visits-in-person
standard in `CURATION-STANDARDS.md`, unchanged. Both numbers live as a
single named constant (not hardcoded inline), so raising them as the app
grows — expected, per this session's discussion — is a one-line change, not
a migration.

The admin dashboard (scope from the prior spec) gets a **Candidates** page:
shops where `promotion_status = 'flagged'` and no `shop_curations` row
exists yet, sorted by log count. **Approve** walks the admin through the
existing shop-curation form, creating the `shop_curations` row (the actual
in-person visits still have to happen first — this just says where to go).
**Reject** sets `promotion_status = 'rejected'` so the trigger won't
re-flag it; the shop keeps existing as a plain, unapproved shop on the map.

### Map rendering / integration

Fits into the existing Mapbox architecture (`@rnmapbox/maps` native,
`mapbox-gl`/`react-map-gl` web, shared `MapView` interface) with one
contract change: `MapView` takes the current viewport bounds instead of a
`city_id`, since coverage is worldwide. On pan/zoom it fires two queries —
the OSM proxy for that bounding box, and a Supabase query for `shops ⋈
shop_curations` within the same bounds. Both render on the same map; only
pin style differs. `city_id` stays relevant for city-guides pages (a
separate, list-based view), just not for the map query itself.

Tapping a pin: an unrated/OSM pin shows name/hours/address/website plus a
"Log a visit" action (lazily creates the `shops` row via `external_id`
upsert, then the `logs` row) and a "Directions" button. A Snob or
community-rated pin shows the existing detour-rated preview, plus the same
logging action. Directions opens
`https://www.google.com/maps/dir/?api=1&destination={lat},{lng}` — one
universal URL, no per-platform branching. Pin/map visual design pulls from
the Claude Design project (see above) rather than being designed fresh in
Mapbox Studio from scratch.

## Data model changes

- `shops.external_id text` (unique where not null), `shops.city_id` and
  `shops.neighborhood` become nullable, `shops.promotion_status text not
  null default 'none' check (in ('none', 'flagged', 'rejected'))`.
- New `shop_curations` table: `shop_id` (PK, FK to `shops`), `writeup`,
  `editorial_rating`, `order_note`, `tag`, `price_tier`. Existing curated
  rows in `shops` (writeup, editorial_rating, order_note, tag, price_tier)
  migrate into this table; those columns are dropped from `shops`.
- Trigger on `logs` insert: recompute log count/avg rating for the shop,
  flip `promotion_status` to `'flagged'` when both thresholds are crossed
  and status is still `'none'`.
- Admin dashboard: new Candidates page (Approve/Reject), reusing the
  `is_admin` RLS model from the prior spec.

## Out of scope for this pass (tracked for later)

- **Overpass rate-limit behavior under real production load.** The public
  instance has fair-use limits, not a contracted SLA. Revisit if it proves
  unreliable at scale — likely fix is a short-lived cache tier or a paid
  Overpass host.
- **`screens/shop.jsx`'s existing hours/menu model tension.** That mockup's
  shop-detail screen frames hours as member-confirmed / shop-claimable
  ("Confirmed by 3 members," "Unclaimed page — Claim it"), which sits
  awkwardly next to this spec's OSM-sourced hours for unrated shops. Not
  resolved here — worth a dedicated pass once the map ships and it's clear
  which data (OSM vs. member-confirmed) actually ends up more reliable.
- **Browsing your own community-shop log history separately from
  Snob-Approved ones.** The existing profile/log feed already covers this
  generically; no special UI planned.
- **Photo upload for community shops** — already deferred generally per
  `CONTENT-OPS.md`.
- **Designing the actual Mapbox Studio style/pin icons** — pull from the
  Claude Design project's revised `screens/map.jsx` first, per above.
