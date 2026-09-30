# Photos, Phase 4: housekeeping

**Date:** 2026-09-30 · **Parent spec:** `2026-09-30-photos-design.md` (section 9; section 10, Phase 4) · **Status:** approved 2026-09-30

**Why:** files outlive their photos. That happens when an admin removes a photo, when someone deletes an entry or their account (the rows cascade away), and when an upload never gets confirmed. Storage is free up to 10 GB and should stay there, with a warning well before the limit.

## 1. One rule

Every night, list every object under `logs/` in the bucket and every `log_photos` row.
- **Keep:** any file referenced by a `live` or `hidden` row.
- **Delete:** anything else **older than 24 hours**. That covers removed photos (the row stays for audit), rows gone with their entry or account, and unconfirmed uploads.
- **Wait:** unreferenced files younger than 24 hours may be uploads still in flight.

**Safety valve:** if a run would delete more than half of 20 or more objects, it deletes nothing and logs an error instead. A bad database read must never empty the bucket.

## 2. Monitoring

Each run logs one line: object count, bytes stored, and uploads this month (photo rows created × 2 files). If bytes or monthly uploads pass `PHOTO_LIMITS.storageWarnRatio` (70%) of the R2 free tier (10 GB, 1M writes a month), it logs a warning. Vercel's runtime logs are where it shows up.

## 3. Pieces

- `apps/web/lib/photos/cleanup.ts`: `planCleanup(objects, rows, now)` is a pure function. `runCleanup(deps)` lists the bucket, reads the rows, deletes, and reports.
- `r2.list(prefix)`: paginated S3 ListObjectsV2.
- `GET /api/cron/photos-cleanup`: requires `Authorization: Bearer $CRON_SECRET`, which Vercel sends on cron calls. It reads rows with the service role.
- `apps/web/vercel.json`: the cron entry, once a day at 08:00 UTC (the Hobby plan allows daily jobs).
- `CRON_SECRET`: a random value on the web project.
- `PHOTO_LIMITS.freeTier`: `{ bytes: 10e9, writesPerMonth: 1e6 }`.

## 4. Checks

- Vitest: the keep/delete/wait rules, the safety valve, the warnings, and the route's secret check.
- Web build.
- A live run of the cron URL with the secret, checking the summary against the bucket.
