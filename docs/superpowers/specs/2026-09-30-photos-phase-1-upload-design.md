# Photos, Phase 1: upload

**Date:** 2026-09-30 · **Parent spec:** `2026-09-30-photos-design.md` (sections 4, 6; section 10, Phase 1) · **Status:** approved 2026-09-30

**Why:** people can add one photo to a log. It's compressed on the device, goes straight to R2, and shows on the log in the feed and on the shop page. Headers, map cards and profile tiles are Phase 2.

## 1. In the app

- **Log form:** a new "Add a photo" section sits under the note.
  - Picking opens the photo library (`expo-image-picker`, one image, no editing). A preview replaces the button, with a Remove action.
  - One line under it reads "Only add photos you took." and links to `/terms` on the website.
- **Compression** (`lib/photos/compress.ts`, `expo-image-manipulator`'s contextual API):
  - Resize to 1600 px on the long edge for the full size and 640 px for the thumbnail. Never upscale.
  - Save as WebP (quality 0.7 full, 0.65 thumbnail). If WebP fails (older Safari, which throws), save both as JPEG at 0.75.
  - Re-encoding drops EXIF.
  - The original is never uploaded.
- **Publish:** the log saves exactly as today (`logVisit`, which returns `logId`). The photo then goes into the pending queue and the screen moves on without waiting.
- **Pending queue** (`lib/photos/pending.ts`): in memory, one job per log.
  - Retries after 5 s, 30 s, 2 min, then every 10 min, and gives up 24 h after the first try.
  - The log shows "Photo pending" on the user's own entry while a job is queued.
  - `ponytail:` closing the app drops a queued photo. Persist the queue if that shows up in practice.
- **Showing photos:** the feed log card and shop page review rows show that log's thumbnail when it's live.
  - Full width of the card's text column, 4:3 max height, `cover`.
  - No credit tag here, since the author's name is already on the card.
  - No BlurHash yet (Phase 2): a `paper2` background behind the image.

## 2. Upload protocol (web routes in `apps/web`)

Both routes are `POST` and require `Authorization: Bearer <Supabase access token>`. They answer CORS for `https://app.coffeesnobproject.com` and `http://localhost:8081`.

**`/api/photos/sign`** takes `{ logId, ext: "webp" | "jpg" }` and returns `{ photoId, fullUrl, thumbUrl }`.
- The user must be signed in, the account active, and the log theirs.
- The log must be under its cap (`PHOTO_LIMITS.perLog`) and the user under the daily cap. Both counts come from the user's own RLS-visible rows. The trigger enforces both caps again on insert.
- The photo id is a fresh UUID. Paths come from `photoPaths`.
- It returns two SigV4-presigned `PUT` URLs (`aws4fetch`, `X-Amz-Expires` from `PHOTO_LIMITS.signedUrlSeconds`) with `content-type` signed in, so the upload must be `image/webp` or `image/jpeg` to match.

**`/api/photos/confirm`** takes `{ logId, photoId, ext, width, height }` and returns the photo `{ id, path, thumbPath, width, height }`.
1. Same auth and ownership checks as sign.
2. Checks both objects exist with a HEAD request, with sizes within `maxFullBytes` and `maxThumbBytes`.
3. Reads the first 64 KB of the full image and refuses it if it isn't a JPEG or WebP, or if it carries EXIF. JPEG: an `APP1` "Exif" segment. WebP: the `VP8X` EXIF flag. The pure `inspectImage(bytes)` function is Vitest-tested with byte fixtures, including a JPEG with a GPS EXIF block. This is the parent spec's server-side guarantee.
4. Inserts the row with the **service role**. The 0038 trigger checks ownership and caps a final time.
5. On any refusal after upload, it deletes both objects.

**Why a service-role insert and not an RPC:** only the route can check the files. An RPC the user could call directly would let a client skip the existence and EXIF checks. The web project needs a new server-only env var, `SUPABASE_SERVICE_ROLE_KEY`, which the owner adds. The nightly cleanup (Phase 4) needs it too.

## 3. Data access

- `packages/supabase`: `log_photos` and `photo_flags` types, plus `shops.header_photo_id`, patched into `Database`.
- `livePhoto(rows)` returns the log's live photo or null.
- `getShopReviews` and `getFollowingFeedLogs` embed `log_photos(id, path, thumb_path, width, height, status)`. `ShopReview` gains `photo`.
- The app builds URLs with `photoUrl(EXPO_PUBLIC_PHOTOS_URL, thumbPath)`.

## 4. Out of scope

Removing a photo from a log (the owner can delete the log, and the button comes with Phase 3 moderation), BlurHash, headers, map and profile surfaces, and cleanup of orphaned uploads.

## 5. Checks

- Vitest:
  - `inspectImage` fixtures
  - request parsing
  - presigned URL shape
  - both route handlers with mocked R2 and Supabase (happy path, not signed in, not their log, over the cap, missing upload, EXIF refused)
  - `fitLongEdge`
  - the upload sequence with a fake `fetch`
  - the retry schedule
  - `livePhoto` and the review mapping
- App and web typecheck, web build, app web export.
- A live round trip once `SUPABASE_SERVICE_ROLE_KEY` is set: pick → publish → object in R2 → row live → thumbnail on the shop page.
