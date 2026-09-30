# Photos, Phase 0: groundwork

**Date:** 2026-09-30 · **Parent spec:** `2026-09-30-photos-design.md` (section 10, Phase 0) · **Status:** approved 2026-09-30

**Why:** later phases need somewhere to put files, one set of limits, and tables that are already safe to write to. This phase adds all three. Nothing user-facing changes except a new `/terms` page. No app code reads the new tables yet.

## 1. Storage: Cloudflare R2 (owner setup)

- **Choice:** R2, per the parent spec (10 GB free, free bandwidth). Supabase's free plan is 1 GB of storage and 10 GB of bandwidth shared with the database, which is too tight. Limits were checked 2026-09-30: [R2](https://developers.cloudflare.com/r2/pricing/), [Supabase](https://supabase.com/pricing).
- **Bucket:** a bucket named `photos`, Standard storage class, with public access through `r2.dev` for now. `photos.coffeesnobproject.com` replaces it after the DNS move, before Phase 1 ships.
- **CORS:** allow `PUT` and `GET` from `https://app.coffeesnobproject.com`, `https://coffeesnobproject.com` and `http://localhost:8081`, with header `content-type`. Native apps don't need CORS.
- **API token:** Object Read & Write, scoped to `photos` only.
- **Environment variables:**

  | Project | Variables |
  | --- | --- |
  | web (`apps/web`) | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=photos`, `NEXT_PUBLIC_PHOTOS_URL` |
  | app (`apps/app`) | `EXPO_PUBLIC_PHOTOS_URL` |

  Both `*_PHOTOS_URL` values are the public base URL. Secrets never go into the app project.

## 2. Shared config: `packages/supabase/src/photos.ts`

`packages/supabase` is the one package the app and web both already depend on, so the config lives there.

- `PHOTO_LIMITS`: per-log cap (1), daily cap (20), full and thumbnail sizes and quality, JPEG fallback quality, BlurHash components, header minimum short edge (600), max file bytes, signed-URL lifetime, retry window, flags-to-hide (2), storage warning ratio (0.7).
- `photoPaths(logId, photoId, ext)` returns `{ path, thumbPath }` in the `logs/<log>/<photo>[_t].<ext>` layout.
- `photoUrl(baseUrl, path)`: the only way any code builds an image URL.
- SQL can't import TypeScript. The migration hard-codes the two caps, and the SQL test drives them with `PHOTO_LIMITS`, so changing one without the other fails the test.

## 3. Migration `0038_log_photos.sql`

- **`log_photos`**, as in parent spec section 5.
  - A `before insert` trigger checks that the photo's owner owns the log, copies `shop_id` from the log, and enforces both caps. The per-log cap counts photos that aren't `removed`, so a removed photo can be replaced. The trigger replaces the draft's `unique (log_id)`.
  - Path check constraints tie `path` and `thumb_path` to `logs/<log_id>/<id>` with a `.webp` or `.jpg` extension.
  - RLS: anyone reads `live` photos, owners and admins read everything, owners delete their own, admins update. There is no insert policy: rows only come from the service role (Phase 1's confirm route).
- **`photo_flags`**, modeled on `place_flags`.
  - Reasons: `wrong_shop`, `inappropriate`, `not_theirs`, `other`. One flag per user per photo.
  - Limited to 20 per user per day.
  - Active users insert their own flags and can't insert one already resolved. Users read their own flags, and admins read and resolve all of them.
  - Auto-hide at two flags is Phase 3.
- **`shops.header_photo_id`**: references `log_photos`, on delete set null. A trigger refuses a pin unless the photo is a `live` photo of that shop. Admins already have update rights on `shops` (0018), so pinning needs no new policy.
- **Rollback** SQL goes in the migration header.

## 4. Terms: `/terms` on the web

- The repo has no terms page yet. This phase adds `/terms` with one section, "Your photos". It is the license to show photos in the app and on the site, including as shop headers, with credit. The person confirms they took the photo, and it comes down when they delete it. Linked from the web footer under About.
- Phase 1's photo picker links to it.
- Full Terms of Service and a Privacy Policy are a separate task (needed for App Store review). They're out of scope here.

## 5. Checks

- Vitest: `photos.ts` unit tests, and a PGlite test of 0038 covering the caps, ownership, paths, RLS by role, flags, and pin rules.
- Migration applied to production after a read-only pre-check of `logs`/`shops`. Supabase advisors should show no new warnings.
- Tracker Status line.
