# Curation system, Phase 6: freshness

**Date:** 2026-09-27 · **Parent spec:** `2026-09-25-curation-system-design.md`
(sections 6.1 Possibly closed, 6.2 Add a missing shop / Credit the finder)
· **Status:** design

Three small pieces that keep the map honest over time.

## 1. Possibly closed (build + admin)

- The build reads every rated shop's `external_id` (`shop_ratings`, public)
  and checks it against the new index: a `cs_` id by id, an older OSM id
  (`node/123`) against every place's source ids. Shops people added
  themselves (`user/…`) are skipped: no source ever had them.
- `report.missingRated`: `{ externalId, builds }`, where `builds` counts
  consecutive builds it's been missing (last build's report + 1). Skipped
  for `--bbox` pilot builds.
- **Closed? tab** on `/admin/shops`: rated shops missing from 2+ builds,
  with name, city, builds missing, last logged. Rated shops are never hidden
  automatically.
  - **Closed:** sets `shops.closed_at`; the shop leaves `shop_ratings` (map,
    city pages). Its logs stay on people's profiles. Listed under "Marked
    closed" with **Reopen**.
  - **Still open:** sets `shops.open_checked_at`; hidden from the tab until a
    later build still can't find it.

## 2. Add a missing shop (app)

- In map search, "No matches." gains **Add a shop that's missing**. The map
  enters pin mode: a crosshair at the map's centre, the list sheet swaps for
  a small bar with a name field and **Log it here**. That opens the normal
  log form with `externalId = user/<uuid>`, so the first rating creates the
  shop, as any other.
- The log screen's "Which shop?" empty state links to the same pin mode.
- Build: each `user/…` shop is linked to the index place within 75 m whose
  name matches (dedupe's core-name rule, or half its words). The link is
  saved in the index itself: the place's `sourceIds` gains `user/<uuid>`, so
  the map's existing rated-duplicate check hides the dot, and logging from
  that dot finds the shop (the map already passes source ids as legacy ids).

## 3. Credit the finder

Owner decision (2026-09-25): no Rising tier, so the one moment worth a
message is Snob-Approval.

- `notifications` (`id`, `user_id`, `kind` = `snob_approved`, `shop_id`,
  `created_at`, `read_at`). Readable and dismissable only by its owner.
- A trigger on `shop_curations` insert tells the shop's finder: whoever
  logged it first.
- Home feed: an unread notification shows as one card at the top ("A shop
  you found is Snob-Approved"), tapping opens the shop, dismiss marks it read.

## Done when

- Unit tests: missing-rated counting across builds, OSM-id and cs_ presence,
  user-shop linking (distance and name), finder trigger in PGlite.
- Migration applied, advisors clean for new objects.
- Admin tab and app pin mode render; tracker updated.

## Out of scope

Push or email delivery (in-app only for now); a notifications inbox.
