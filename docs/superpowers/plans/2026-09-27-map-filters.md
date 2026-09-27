# Map Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace All/Rated/Make the trip chips with Effort ▾ and You ▾ dropdown chips.
**Architecture:** Pure filter in `shop-list.ts`; `getMyShops` query + `useMyShops` hook; `fitPoints` for the zoom-to-fit; two `FilterMenu` chips.
**Tech Stack:** Expo Router / RN Web, supabase-js, vitest. Spec: `docs/superpowers/specs/2026-09-27-map-filters-design.md`.

- [ ] Task 1: `getMyShops` in `packages/supabase/src/queries.ts` + test (saves + logs ids, shop_ratings rows, never-rated saved shops from `shops`).
- [ ] Task 2: `MapFilter = { effort, you }`, options, `applyFilter(filter, rated, nearby, mine)`; tests for each option and a combination. Update `buildSearchSections` to the same predicate.
- [ ] Task 3: `fitPoints` in `lib/map/bounds.ts` + test.
- [ ] Task 4: `useMyShops` hook (loads on focus when You ≠ Any).
- [ ] Task 5: `FilterMenu` chips in `map-controls.tsx`; wire `map.tsx` (fit on Saved/Been, empty-state copy, hide You signed out).
- [ ] Task 6: tsc + tests, tracker line, push.
