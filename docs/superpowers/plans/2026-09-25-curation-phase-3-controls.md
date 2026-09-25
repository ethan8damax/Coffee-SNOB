# Curation Phase 3: Controls — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Chain Block/Allow (with per-chain prefix matching), per-place show/hide overrides, and user reports, wired through the database, the monthly build, the admin and the app.

**Architecture:** One migration (0028) adds the columns, tables and two security-definer read functions. `@coffeesnob/supabase` gets the queries. The build reads decisions/overrides/flag counts through the anon key; the admin writes through the signed-in admin session (RLS `is_admin()`); the app reads hides once per session and inserts flags as the signed-in user.

Spec: `docs/superpowers/specs/2026-09-25-curation-phase-3-controls-design.md`.

### Task 1 — Chain status and prefix, both twins
- Fixture: entries gain optional `status` / `prefix`; cases for a prefix chain (`tim hortons` + Q175106 + prefix → "Tim Hortons Cafe and Bake Shop" true, "Tim Hortonsville" false) and an allowed name (`joes coffee` allowed → "Joe's Coffee Midtown" false).
- Twin test creates `chain_blocklist(name, wikidata, status, prefix)`; TS side receives only blocked entries (as `getChainBlocklist` will).
- `isChain`: leading-word match when `!c.wikidata || c.prefix`.
- Migration 0028 `is_chain_name`: `b.status = 'blocked'` and `(b.wikidata is null or b.prefix)` for leading words.

### Task 2 — Overrides, flags, hides (same migration)
- Tables, RLS, 20-per-24h trigger, `active_place_hides()`, `place_flag_counts()`; grants. Apply with the Supabase tool; run advisors.

### Task 3 — Queries (`packages/supabase`)
- `getChainBlocklist` (blocked only, with `prefix`), `getChainDecisions` (all), `addChainBlock` (unchanged), `allowChain`, `setChainPrefix`, `getPlaceOverrides`, `setPlaceOverride`, `getActivePlaceHides`, `getPlaceFlagCounts`, `flagPlace`, `getMyPlaceFlags`, `getOpenPlaceFlags`, `resolvePlaceFlags`. Unit tests with the existing fake-client pattern.

### Task 4 — Build
- `BuildInput` gains `overrides` and `notSpecialty` counts and `decided` chains. Pipeline: hide → drop (before ids), show → `visibility: "show"`, why "Picked by Coffee Snob"; penalty −1 per flag, cap from config. Report suggestions skip decided names/ids. Tests.

### Task 5 — Admin tabs
- `?tab=shops|chains|flags|build` on `/admin/shops`; chains/flags/build as server components in the same folder; server actions for Block/Allow/Prefix/Hide/Dismiss. Report and manifest fetched from `COFFEE_INDEX_ORIGIN` (1 h revalidate).

### Task 6 — App
- `useActivePlaceHides()` (once per session) → filter dots and index search results.
- Preview card: why line; "Something off?" → three kinds; signed-out → sign-in; sent state.

### Task 7 — Verify, tracker, merge, push
