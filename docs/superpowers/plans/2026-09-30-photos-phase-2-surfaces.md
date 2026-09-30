# Photos Phase 2 — Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each shop's photo shows on the shop band, the map card, list rows and profile tiles, with daily rotation, pins, a gallery, credit tags, and a street-map fallback on the web.

**Architecture:**
- One SQL function, `shop_headers`, picks each shop's header: pin, then daily rotation.
- `packages/supabase` wraps it, adds a gallery query, and gives profile entries their photos.
- The app renders headers in the existing components.
- A web-only `StreetBand` draws the fallback with MapLibre, using a `streetsStyle()` transform of the existing basemap style.

**Tech Stack:** Postgres (PGlite tests), supabase-js, Expo Router + react-native-web, `maplibre-gl` (already installed), Vitest.

Spec: `docs/superpowers/specs/2026-09-30-photos-phase-2-surfaces-design.md`.

## Tasks

Each task: test, watch it fail, implement, watch it pass, commit.

1. **`0039_shop_headers.sql`**
   - PGlite test in `packages/supabase/test/shop-headers-sql.test.ts`: pin wins; hidden pin falls through; hidden/small skipped; landscape preferred; portrait-only works; same pick all day, several picks across 30 days; username returned; empty array returns nothing.
   - Then the function, and apply it to production after a read-only check.
2. **Queries**
   - Add `ShopHeader`, `getShopHeaders`, `getShopPhotos`, and `ProfileEntry.photo`, with tests in `test/queries.test.ts`.
   - Patch types: the `shop_headers` function, and the `log_photos_user_id_fkey` → profiles relationship.
3. **`streetsStyle`** in `apps/app/components/map/streets-style.ts`, with a test.
4. **Components**
   - `components/photos/credit-tag.tsx`
   - `components/photos/street-band.web.tsx` and `street-band.tsx` (native: null)
   - `components/photos/gallery.tsx`
5. **Wire them in**
   - `Hero` (`useShop` fetches header and photos)
   - `PreviewCard` and `ShopTile` (the nearby loader attaches `header` to rated pins)
   - `EntryTile`
6. **Verify:** all suites, typechecks, the app web export, the tracker line, push, and a live check.
