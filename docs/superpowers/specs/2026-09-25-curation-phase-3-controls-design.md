# Curation system, Phase 3: controls

**Date:** 2026-09-25 · **Parent spec:** `2026-09-25-curation-system-design.md`
(sections 5.3, 6.1, 6.2, 6.4 Phase 3) · **Status:** design

**Why:** the index's mistakes need fixing by people, cheaply: chains the
build suggests (Tchibo, Panera, 할리스, "starbucks …" leftovers), single
places that are wrong, and closures users see before any dataset does.

## Database (migration 0028)

- **`chain_blocklist`** gains `status` (`blocked` | `allowed`, default
  `blocked`) and `prefix` (boolean, default false). `allowed` records a "not a
  chain" decision so the suggestion never comes back. `prefix` lets an entry
  with a brand ID also match names that *start* with it — the one-click fix
  for "Starbucks Gig Harbor"-style leftovers, chosen per chain by a person
  (never automatic, so "costa" can't hide "Costa Rica Café").
  `is_chain_name` matches only `blocked` rows; leading-word matches apply to
  name-only rows and `prefix` rows. TS twin (`isChain`) and the shared
  fixture change together.
- **`place_overrides`** (`place_id` text PK — a `cs_` id, `action` show |
  hide, `reason`, `created_by`, `created_at`). Public read, admin write.
- **`place_flags`** (`id`, `place_id`, `place_name`, `lat`, `lng`,
  `user_id`, `kind` closed | not_specialty | wrong_location, `created_at`,
  `resolved_at`; unique per place, user and kind). Insert: signed-in,
  `is_active()`, own `user_id`, at most 20 in 24 h (trigger). Read: own rows
  or admin. Resolve: admin.
- **`active_place_hides()`** (security definer, callable by anyone): place
  ids hidden now — `hide` overrides, plus places with unresolved `closed`
  flags from 2+ different users.
- **`place_flag_counts()`** (security definer): per place, distinct users
  with an unresolved `not_specialty` flag. Only counts, never who.

## Build (packages/coffee-index)

Reads overrides, flag counts and the full chain list (blocked + allowed).
`hide` override → dropped; `show` → always show (why: "picked by Coffee
Snob"); each `not_specialty` flag −1, capped at −3 (config). Suggestions
skip anything with a decision (blocked or allowed).

## Admin (/admin/shops tabs: Shops · Chains · Flags · Build)

- **Chains:** suggested chains from the live build's `report.json`
  (aggregated across countries, top 60), each with **Block** and **Allow**.
  Block: a brand ID → blocked by ID; a "starbucks …" group → sets `prefix`
  on that chain; otherwise a name-only entry. The existing lookup and
  blocked list move here.
- **Flags:** unresolved flags grouped by place (name, counts per kind,
  newest first) with **Hide** (hide override + resolve), **Dismiss**
  (resolve), and **Map** (opens the app at the place).
- **Build:** the live build's report: version, sources, counts, change vs
  last month, alarm, top countries.

## App

- Once per session, `active_place_hides()`; those ids drop from index dots
  and search results.
- Index dot preview: a "why" line (the build's reasons, e.g. "In 3 sources ·
  Listed as a coffee shop") and **Something off?** → Closed · Not specialty ·
  Wrong spot. Signed out → sign-in prompt. One tap sends; the card says
  "Thanks — we'll look." Already-reported kinds show as sent.

## Done when

- Twin fixture covers `status` and `prefix` on both sides; unit tests for
  build overrides/flag penalties, suggestion filtering, hides dropping.
- Migration applied; advisors clean for the new tables and functions.
- Admin: block and allow a suggestion, set prefix on a leftover group, hide
  and dismiss a flag (checked against production with a test flag, then
  removed).
- App: report a place signed in; two users' "closed" hides it on reload.

## Out of scope

Roaster signals (Phase 5), clout tiers (Phase 4), owner claims.
