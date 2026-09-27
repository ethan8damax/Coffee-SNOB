# Curation system, Phase 5: roasters

**Date:** 2026-09-27 · **Parent spec:** `2026-09-25-curation-system-design.md`
(sections 5.1, 5.2) · **Status:** design

The strongest signal an unrated café can have: a roaster we trust says it
pours their coffee. The admin pastes a roaster's stockist list; the monthly
build finds each stockist in the index and shows it on the map.

## Database (migration 0031)

- `roasters`: `id`, `name`, `website`, `country_code`, `notes`, `created_at`.
- `roaster_stockists`: `id`, `roaster_id` → roasters (cascade), `raw_name`,
  `raw_address` (not null, `''` when the line has none), `matched_id` (`cs_`
  id or null), `added_at`. Unique per roaster + name + address, so pasting
  the same list twice adds nothing.
- Both are public read (the build uses the anon key; stockist lists are
  public on roasters' own sites) and admin write.

`matched_id` is **only the admin's hand fix**. The build's own matches live
in the build report, so a wrong automatic match never gets baked into the
database, and fixing one is a single pin.

## Matching (in the build)

For each stockist line without a pinned `matched_id`:

1. Candidates: index places whose name matches on core words (the dedupe
   rule: same core name, or one is the other plus trailing words), or share
   at least half their words.
2. Narrow by address: the line's words and house numbers against the
   place's address, locality and region. Roaster's country breaks ties when
   the line has no address.
3. Exactly one best candidate → matched. None or a tie → unmatched, and the
   report keeps up to three candidates for the admin.

A roaster's **own café**: an index place on the roaster's website domain
(never a shared platform like instagram.com). Matching by name alone was
dropped: "Heart" in one country hits every Heart Café. A café without its own
website goes in as a stockist line.

Visibility (parent 5.1): +3 and a `why` of "serves <Roaster>" or
"<Roaster>'s own café". Either alone shows the dot.

## Report

`report.roasters`: per stockist `{ id, matchedId, place?, candidates? }` and
per roaster the own-café count. `place` / `candidates` carry name, address
and locality so the admin never needs to open the index.

## Admin

A **Roasters** tab on `/admin/shops` (next to Leads, Chains, Flags, Build,
rather than a separate page: one place for curation).

- List: roaster, country, stockists, matched / unmatched from the live build.
  Add a roaster (name, website, country, notes).
- One roaster (`?tab=roasters&roaster=<id>`): paste stockists (one per line,
  `Name, address` or tab-separated from a spreadsheet), the stockist table
  with each line's state: matched (place name + locality), waiting for the
  next build, or no match with candidate buttons ("This one"). Matched lines
  keep the runners-up behind "Wrong café?". Pinned lines can be unpinned. Remove a line, delete the
  roaster.

## Done when

- Unit tests: parse pasted lines, match by name + address, tie → unmatched
  with candidates, pinned id wins, own café by domain (not platforms),
  +3 visibility and why.
- Migration applied, advisors clean for the new tables.
- Tab renders; the next build (manual workflow run) reports matches.

## Out of scope

Crawling stockist pages (parent spec: mostly JS widgets). Triggering the
build from the admin (run the workflow from GitHub).
