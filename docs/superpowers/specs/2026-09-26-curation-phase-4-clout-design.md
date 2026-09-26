# Curation system, Phase 4: clout (admin-only)

**Date:** 2026-09-26 · **Parent spec:** `2026-09-25-curation-system-design.md`
(section 5.4, 6.1 Leads) · **Status:** design

**Owner decision (2026-09-25), which changes the parent spec:** no
user-facing tiers or badges. Users see only the 5-level effort rating
(Stay home → Catch a flight). Clout exists to tell the admin which shops are
collecting strong ratings from enough different people to deserve a visit.
Snob-Approval gets its own tag/page treatment later. So "Local favourite",
"Rising" and their badges are dropped; the app does not change.

## What clout is

Per shop, recomputed on every log insert, update or delete:

- **Loggers:** distinct people, each counted once by their most recent log
  for that shop. Accounts younger than 7 days don't count.
- **Weight:** a log whose visit is older than 18 months counts half.
- **Adjusted rating:** `(5 × C + Σ w·r) / (5 + Σ w)` where `C` is the
  average of every counted latest-rating across all shops. Two 5-star logs
  no longer beat forty 4.6s.
- **Signal:** a shop is a **lead** at 5+ loggers with an adjusted rating of
  4.2 or more (the old trigger's bar, now per person and shrunk toward the
  mean). The same trigger sets `promotion_status = 'flagged'`, as before;
  `'rejected'` and curated shops are never flagged again.

Thresholds live as named constants in one SQL function (like 0009 did), so
raising them is a one-line migration.

## Database (migration 0030)

- `shop_clout` (`shop_id` PK → shops, `loggers`, `adjusted` numeric(3,2),
  `first_log_at`, `last_log_at`, `updated_at`). Admin read only (it's an
  internal signal); written only by the trigger (security definer).
- `recompute_shop_clout(shop_id)` + trigger on `logs` (insert/update/delete)
  replacing `check_shop_promotion` / `on_log_insert_check_promotion`.
- `curation_visits` (`id`, `shop_id`, `visited_on`, `visited_by` default
  auth.uid(), `notes`, `created_at`). Admin read/write.
- Backfill `shop_clout` for every shop with logs.

## Admin

- **Leads tab** on `/admin/shops` (first tab after Shops): shops flagged and
  not yet curated, ranked by adjusted rating then loggers, showing loggers,
  the shop's effort-scale consensus (chevrons, never a number), first logged,
  and visits (0 / 1 / 2). Shops whose first log is under 90 days old sit in a
  quieter "Too new to visit" list (CURATION-STANDARDS: wait 90 days).
- Each lead: **Log a visit** (date + notes → `curation_visits`), the two
  visits listed, **Approve** (opens the existing curation editor) once two
  visits exist, **Not a fit** (existing reject).

## Done when

- Unit-tested SQL behaviour in PGlite: dedupe per person, new-account
  exclusion, 18-month half weight, shrinkage (2×5★ ranks below 40×4.6★),
  flagging at the bar, rejected never re-flagged.
- Migration applied; advisors clean for new objects; backfill matches.
- Leads tab renders against production (admin checks it signed in).

## Out of scope

Anything user-facing; notifications to the finder (Phase 6).
