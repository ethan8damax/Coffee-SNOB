# Photos Phase 1 — Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One photo per log, compressed on the device, uploaded straight to R2 through signed URLs, confirmed by a server route, and shown on feed log cards and shop review rows.

**Architecture:**
- **App (`apps/app`):** picks and compresses the photo, saves the log, then queues the upload in memory: sign → PUT ×2 → confirm.
- **Web (`apps/web`):** two routes. `sign` checks ownership and caps, then presigns with `aws4fetch`. `confirm` HEADs both objects, checks for EXIF, then inserts the row with the service role.
- **`packages/supabase`:** types, `livePhoto`, and the two queries that embed photos.

**Tech Stack:** Expo 57 (`expo-image-picker`, `expo-image-manipulator` contextual API), Next.js route handlers, `aws4fetch`, Supabase, Vitest.

Spec: `docs/superpowers/specs/2026-09-30-photos-phase-1-upload-design.md`. Dependencies are already installed: `expo-image-picker`, `expo-image-manipulator` (app) and `aws4fetch` (web).

---

## File map

| File | Responsibility |
| --- | --- |
| `packages/supabase/src/types.ts` | `log_photos`, `photo_flags`, `shops.header_photo_id` |
| `packages/supabase/src/photos.ts` | + `livePhoto`, `LogPhoto`, `PhotoRow` |
| `packages/supabase/src/queries.ts` | Embed photos in `getShopReviews` and `getFollowingFeedLogs`; `ShopReview.photo` |
| `apps/web/lib/photos/inspect.ts` (+ test) | `inspectImage(bytes)`: JPEG/WebP only, no EXIF |
| `apps/web/lib/photos/requests.ts` (+ test) | Body parsing for sign and confirm |
| `apps/web/lib/photos/r2.ts` (+ test) | Presign PUT, HEAD, range GET, DELETE |
| `apps/web/lib/photos/auth.ts` | Bearer token → user + active check; service-role client |
| `apps/web/lib/photos/handlers.ts` (+ test) | Route logic with injected deps |
| `apps/web/app/api/photos/sign/route.ts`, `confirm/route.ts` | Thin wrappers and CORS |
| `apps/app/lib/photos/compress.ts` (+ test for `fitLongEdge`) | Resize and encode |
| `apps/app/lib/photos/upload.ts` (+ test) | sign → PUT → confirm |
| `apps/app/lib/photos/pending.ts` (+ test) | In-memory retry queue and subscribe |
| `apps/app/components/log/photo-field.tsx` | Picker, preview, Remove, terms line |
| `apps/app/components/log/log-form.tsx` | Use the field; enqueue after publish |
| `apps/app/components/photos/log-photo.tsx` | Thumbnail, or "Photo pending" for your own entry |
| `apps/app/components/feed/log-card.tsx`, `components/shop/parts.tsx`, `lib/feed/*` | Show it |

## Tasks

Each task follows TDD: write the test, watch it fail, implement, watch it pass, commit.

1. **Types and `livePhoto`.**
   - Patch `Database` with the three changes from migration 0038.
   - `livePhoto(rows)` returns the first row with `status === "live"`, mapped to camelCase, or null.
   - `getShopReviews` selects `log_photos(id, path, thumb_path, width, height, status)` and maps `photo: livePhoto(l.log_photos)`. Update its test to expect `photo: null`, and add a case with a live row and a hidden row.
   - `getFollowingFeedLogs` adds the same embed.
2. **`inspectImage`.** Returns `"ok" | "not_image" | "metadata"`.
   - JPEG: walk segments from `FFD8` and return metadata if an `FFE1` segment starts with `Exif\0\0`; stop at `FFDA`.
   - WebP: `RIFF….WEBP`, and if the first chunk is `VP8X`, EXIF flag `0x08` at byte 20 means metadata. A plain `VP8 `/`VP8L` WebP can't carry EXIF.
   - Anything else is `not_image`.
   - Fixtures: a clean JPEG, a JPEG with an APP1 Exif GPS block, clean VP8 and VP8X WebPs, a VP8X with the EXIF flag, and a PNG.
3. **Request parsing.**
   - `parseSign(body)` needs `logId` to be a UUID and `ext` to be `webp` or `jpg`.
   - `parseConfirm(body)` adds `photoId` (a UUID) and integer `width` and `height` in 1..1600 whose long edge is at most `PHOTO_LIMITS.full.longEdge`.
   - Both return the parsed object or null.
4. **R2 client.**
   - `r2FromEnv()` builds an `AwsClient` (`service: "s3"`, `region: "auto"`) and the endpoint `https://<account>.r2.cloudflarestorage.com/<bucket>/`.
   - `presignPut(key, contentType)` signs a query URL with `X-Amz-Expires`.
   - Also `head(key)` → `{ size } | null`, `readStart(key, bytes)`, and `remove(key)`.
   - Test: the presigned URL has `X-Amz-Signature`, `X-Amz-Expires=300`, and the key path.
5. **Handlers.**
   - `handleSign(deps, token, body)` and `handleConfirm(deps, token, body)` return `{ status, body }`.
   - `deps = { userFromToken, userDb(token), adminDb, r2 }`.
   - Tests with fakes cover: 401 without a user, 403 when suspended, 404 when it isn't their log, 409 at the per-log cap, 429 at the daily cap, 200 with URLs, confirm 400 when an upload is missing (and it deletes), 413 when too big, 422 on EXIF, 200 inserts, and a trigger error → 409 with the files deleted.
6. **Routes.** Thin `POST` and `OPTIONS` wrappers with CORS headers, using the real deps. `SUPABASE_SERVICE_ROLE_KEY` is read on the server only. Run the web build.
7. **Compression.**
   - `fitLongEdge(w, h, max)` is a pure function, tested.
   - `compressPhoto(uri, w, h)` renders full and thumbnail, tries WebP, and falls back to JPEG on error.
   - Returns `{ ext, full: { uri, width, height }, thumb: { uri } }`.
8. **Upload.**
   - `uploadLogPhoto({ apiBase, token, logId, photo, fetchImpl })`: sign, PUT both (reading each local URI as a blob, with the matching content type), then confirm.
   - Throws on any non-OK response.
   - Test with a recording fake `fetch`.
9. **Pending queue.**
   - `enqueuePhoto(logId, run)` runs now, then retries on `RETRY_DELAYS_MS = [5e3, 30e3, 120e3]` followed by every 600e3, until `retryHours` pass.
   - Also `isPending(logId)` and `subscribe(fn)`.
   - Test with fake timers.
10. **Log form.**
    - `PhotoField` holds `{ uri, width, height }` of the picked image.
    - On publish, after `logVisit` returns `logId`, it compresses and enqueues without awaiting the upload, then navigates.
    - It gets the access token from `supabase.auth.getSession()` at run time, and `apiBase` from `EXPO_PUBLIC_WEB_APP_URL`.
11. **Show photos.**
    - `LogPhoto` takes `{ photo, logId, mine }` and renders the thumbnail, or a "Photo pending" label when `mine` and `isPending(logId)`.
    - Wire it into `LogCard` (`LogFeedCard.photo`) and `ReviewRow`.
12. **Verify and ship.**
    - Run all package, web and app tests and typechecks, the web build, and the app web export.
    - Add a tracker Status line and push.
    - Live round trip once the owner adds `SUPABASE_SERVICE_ROLE_KEY`.
