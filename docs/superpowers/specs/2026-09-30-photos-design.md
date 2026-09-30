# Coffee SNOB — Photos Spec

Sep 30, 2026 · @Ethan Maxey

Supersedes the Sep 29 draft ("Photos Spec"). Mockups from the brainstorm:
[header options](https://claude.ai/artifact/71n3ZMRuYGh3T9qvRjuz7W) and
[photo surfaces](https://claude.ai/artifact/2BmxwRUFttz9XBdiyw1K3e).

## 1. Summary

Users add a photo to a log. Those photos become the shop's header, rotating daily, with an admin pin that overrides rotation. Shops without a photo keep today's look: the shop page's oxblood band gains faint nearby streets.

Photos cost nothing to start and stay cheap as they grow. That comes from three choices: Cloudflare R2 (free bandwidth), compression on the phone (no originals, no server-side processing), and a nightly cleanup job.

No photos are taken from Google, Instagram, Foursquare or shop websites. Their terms or copyright forbid it.

**Instructions to Claude Code**

1. Read `CLAUDE.md`, `apps/web/PRODUCT.md` (all copy), `apps/web/DESIGN.md` and `MONETIZATION.md` first.
2. Follow repo conventions: migrations from `0038_…`, RLS on every new table, queries in `packages/supabase`, Vitest, a spec and plan in `docs/superpowers/` per phase, a Status line in `docs/v1-launch-tracker.md`.
3. Build in the phase order of section 10. Each phase ships on its own and is reversible.
4. All limits (sizes, quality, caps, thresholds) live in one config file shared by the app, web and backend.
5. Ask before adding any paid service.

## 2. What changed from the draft, and why

| Draft | Now | Why |
| --- | --- | --- |
| R2 or Supabase Storage, undecided | **R2** | Supabase's free plan has 1 GB of file storage and 10 GB of bandwidth, and that bandwidth is shared with the database and API. R2 has 10 GB free and bandwidth is always free. |
| Up to 3 photos per log | **1** (a config value) | Keeps feeds tidy and storage small. Snob+ could raise it later. |
| 400 px thumbnail | **640 px** | The profile entry tile is portrait and about 375 px wide. A 400 px landscape thumbnail cropped to fill it would be too soft. |
| `photo_likes` table, `likes_count`, header picked by likes | **Dropped.** Headers rotate daily, and pins override | Rotation shares the header among everyone who contributed. Pins handle curation. That saves a table, a trigger and a second like button. |
| `pending` status and 24h stuck-row cleanup | **Dropped.** Upload first, then insert the row as `live` | No half-finished rows exist. |
| SHA-256 duplicate check | **Dropped** | At 1 photo per log, the daily upload cap is enough. |
| Reject images under 600 px | **Accept them, but never use them as headers** | They're fine as log photos. |
| Admin web upload for Snob-Approved shops | **Log your visit in the app with a photo, then pin it** | Avoids a second upload path with its own compression in the browser. |
| Pattern or map generated header, colors picked from the shop id | **The existing oxblood band with faint streets**, shop page only | Every other surface already has a fallback that looks intentional. |
| Mapillary street images (Phase 5) | **Deferred** | Revisit once we see how many rated shops still have no photo. |
| Optional pruning | **Removed** | It was speculative and off by default. |

## 3. Storage

**Bucket:** one public-read R2 bucket, `photos`, served from `photos.coffeesnobproject.com`.

- **Domain prerequisite, before Phase 1 ships.** Move `coffeesnobproject.com` DNS from GoDaddy to Cloudflare. GoDaddy stays the registrar. Import the existing records, then check them against GoDaddy's list before switching nameservers:
  - Vercel A/CNAME records, set to **DNS only** (grey cloud)
  - MX records
  - Resend DKIM/SPF records

  Until the move, development uses the bucket's `r2.dev` URL.
- **Paths:** `logs/<log_id>/<photo_id>.webp` and `logs/<log_id>/<photo_id>_t.webp`. Photo ids are UUIDs, never names the user supplied.
- **Provider-neutral.** The database stores paths only, never full URLs. Every image URL comes from one `photoUrl(path, size)` helper that reads the base URL from config. Moving providers later means copying the bucket, changing that base URL, and changing the signing route.
- **Uploads go straight from the phone to R2** through short-lived signed PUT URLs from a route in `apps/web` (section 6). Images never pass through our servers.
- **Caching:** files are immutable, so they're served with `Cache-Control: public, max-age=31536000, immutable`.
- **Secrets:** R2 access keys live only in the `apps/web` server environment and CI, never in the app bundle.
- **Budget:** about 185 KB per photo (full plus thumbnail). The 10 GB free tier holds roughly 55,000 photos.

## 4. Compression (on the phone, before upload)

| Output | Size | Format | Target |
| --- | --- | --- | --- |
| Full | 1600 px long edge | WebP, quality 70 | ~120–180 KB |
| Thumbnail | 640 px long edge | WebP, quality 65 | ~30–40 KB |
| Placeholder | BlurHash, 4×3 components | Text in the database | ~30 bytes |

- Use `expo-image-manipulator` for resizing and WebP.
- Verify WebP output on iOS, Android and web. Fall back to JPEG quality 75 wherever WebP fails. The extension follows the format.
- Generate the BlurHash from the thumbnail.
- **Strip all metadata.** Phone photos embed GPS. Re-encoding drops EXIF, but the signing route's confirm step also checks the uploaded full image for EXIF/GPS markers and refuses the photo if any are found. A Vitest test covers that check with a fixture containing GPS. This is the server-side guarantee, because the native manipulator can't run in Vitest.
- Never upload or store the original.
- Photos under 600 px on the short edge are accepted but marked not header-eligible (section 7).

## 5. Data model

**`log_photos`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key, also the file name |
| `log_id` | uuid | References `logs`, on delete cascade |
| `shop_id` | uuid | Copied from the log, for fast shop queries |
| `user_id` | uuid | Owner, references `profiles` |
| `path`, `thumb_path` | text | Bucket paths |
| `width`, `height` | smallint | Of the full image, for layout without loading it |
| `blurhash` | text | Placeholder |
| `status` | text | `live`, `hidden`, `removed` |
| `created_at` | timestamptz | |

- Unique on `log_id` while the per-log cap is 1. The cap is enforced by a trigger that reads the config value, so raising it later needs no schema change.
- A daily cap of 20 uploads per user, enforced by a trigger modeled on `limit_place_flags`.
- **`photo_flags`** (`photo_id`, `user_id`, `reason`, `created_at`, `resolved_at`, unique pair): modeled on `place_flags`.
- **`shops.header_photo_id`**: nullable, references `log_photos`, on delete set null. This is the pin.
- **RLS on `log_photos`:**
  - anyone reads `live` photos
  - owners read their own photos in any status
  - owners delete their own photos
  - admins update status and pin headers
  - no client insert policy: rows are inserted only by the confirm route (section 6), which uses the service role after checking ownership, active status and caps
- **RLS on `photo_flags`:** active users insert their own flags; users read their own, admins read all and resolve.
- A deleted log cascades to its photo rows. The cleanup job deletes the files.

## 6. Upload flow

1. In the log form, the user picks one photo. The phone compresses it (section 4) and shows it right away from the local file.
2. On submit, the log saves first, exactly as today. Then the app calls `POST /api/photos/sign` with the log id and file formats.
   - The route checks the Supabase session, that the account is active, that the user owns the log, that the log is under its photo cap, and that the user is under the daily cap.
   - It returns two signed PUT URLs that expire in 5 minutes, plus the new photo id.
3. The phone uploads both files, then calls `POST /api/photos/confirm` with the photo id, dimensions and BlurHash. The route:
   - HEADs both objects to confirm they exist and are under the size limits
   - checks the full image for EXIF/GPS
   - inserts the `log_photos` row as `live`
4. If the upload or confirm fails, the log is already saved. The app keeps the compressed files and retries in the background, showing a small "Photo pending" state on the log card. It gives up after 24 hours and deletes the local files.
5. Files uploaded without a confirmed row are orphans, and the nightly job deletes them (section 9).

## 7. Where photos appear

A photo is **header-eligible** when it is `live`, landscape, and at least 600 px on its short edge.

**Header selection** (computed, never stored, except the pin):
1. `shops.header_photo_id`, if set and still `live`.
2. Otherwise **today's rotation**: among the shop's header-eligible photos, sorted by id, pick index `hash(shop_id + UTC date) mod count`. Everyone sees the same header on a given day, shared links look the same, and nothing is written.
3. Otherwise the surface's own fallback, below.

| Surface | With a photo | Without a photo |
| --- | --- | --- |
| **Shop page band** | Full-size header photo fills the band, darkened toward the bottom so the name reads; black credit tag top-right | Today's oxblood band, plus faint nearby streets in a lighter oxblood, drawn from the OpenFreeMap tiles the map already uses; a non-interactive mini map; black "© OpenStreetMap" tag top-right |
| **Map, selected shop card** | Header thumbnail sits on top of the card, and the card grows to fit it; the letter square goes; the close button moves onto the photo's corner; applies to every shop with a photo, whatever its rating | Unchanged |
| **Map list rows** (`ShopTile`) | Header thumbnail replaces the letter square; row height unchanged | Unchanged |
| **Unrated place card** | Can't happen (no logs means no photos) | Unchanged |
| **Profile entry tiles** | That log's own photo → otherwise the shop's header photo; existing scrim, №, name and chevrons on top; never rotates for the user's own photo | Today's solid ground |

- **Credit:** a black tag (ink ground, cream Area Extended label), always in the top-right corner. It reads "Photo by @username" and links to their profile, and follows the photo through rotation.
- **Loading:** BlurHash placeholders. Feeds, lists and cards use thumbnails only. Below-the-fold images lazy-load.
- **Gallery:** the shop page shows the shop's live photos as a thumbnail strip. Tapping one opens the full size with its credit.

## 8. Moderation and admin

- Photos go live immediately. **Two distinct flags** set `status = 'hidden'` until reviewed.
- **Reporting:** a "Report photo" action on the full-size view, using the existing Tell us report pattern.
- **Admin Inbox:** a new **Photos** section lists hidden and flagged photos with Restore or Remove. The sender hears the decision in the feed, the same way other Inbox items work.
- **Admin shop view:** the shop's live photos, with Pin and Unpin. Pinning stops rotation for that shop.
- **Snob-Approved shops:** log your own visit in the app with a photo, then pin it.
- **Removed photos:** the row stays as `removed` for audit, and the nightly job deletes the files.
- **Shop owners** reporting a photo of their shop use the same flag flow, with no special powers.
- **Terms:** add a clause where users grant Coffee SNOB a license to display their photos in the app and on the site, including as shop headers, and confirm they took the photo. Copy follows PRODUCT.md.

## 9. Keeping storage and cost minimal

- **Nightly cleanup job** (a Vercel cron on `apps/web`). It deletes files for:
  - `removed` photos
  - rows gone through log or account deletion
  - any bucket object with no matching row that's older than 24 hours (orphans)
- **Caps:** 1 photo per log, 20 uploads per user per day.
- **Serving:** immutable caching, thumbnails everywhere except the shop page band and the full-size view.
- **Monitoring:** the cleanup job logs bucket size, object count and the month's upload count. It warns when any of them reaches 70% of the R2 free tier (10 GB stored, 1M writes, 10M reads).

## 10. Build plan

| Phase | Ships |
| --- | --- |
| **0 — Groundwork** | R2 bucket and keys, shared photo config, `photoUrl()`, migrations for `log_photos`, `photo_flags`, `shops.header_photo_id` and the cap triggers, the terms clause |
| **1 — Upload** | Compression on the phone (WebP check on all three platforms), sign and confirm routes, EXIF/GPS check and its test, retry and "Photo pending", photo on log cards. **Needs the DNS move.** |
| **2 — Surfaces** | Header selection and rotation, shop page band (photo and street fallbacks), map card photo, list row thumbnails, profile tiles, credit tag, gallery, BlurHash |
| **3 — Moderation** | Report photo, auto-hide at two flags, Inbox Photos section, pin and unpin in the admin shop view |
| **4 — Housekeeping** | Nightly cleanup, orphan removal, size and usage monitoring |

Every phase ends with reversible migrations, passing tests, and a Status line in `docs/v1-launch-tracker.md`.

## 11. Not doing

- Pulling photos from Google Places, Foursquare, Instagram or shop websites.
- Storing originals or any image larger than 1600 px.
- Server-side image processing (paid on both Cloudflare and Supabase).
- Video.
- Per-photo likes.

## 12. Later

- **Mapillary** street-level fallback for rated shops without photos. Revisit once Phase 2 data shows how many rated shops lack a photo.
- **Snob+:** more photos per log (a config change), and choosing which of your own photos shows on your profile tiles and collections. Public shop headers stay earned (rotation and admin pins), never paid, per `MONETIZATION.md`.
