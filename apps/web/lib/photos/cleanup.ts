import { PHOTO_LIMITS } from "@coffeesnob/supabase";

// Nightly housekeeping (photos Phase 4 spec): delete every file no live or
// hidden photo points at, once it's a day old, and warn before the free tier
// runs out. One rule covers removed photos, deleted entries and accounts, and
// uploads that were never confirmed.

export type BucketObject = { key: string; size: number; lastModified: string };
export type PhotoRowRef = { path: string; thumb_path: string; status: string };

const DAY_MS = 24 * 3600_000;

export function planCleanup(objects: BucketObject[], rows: PhotoRowRef[], now: Date) {
  const keep = new Set(rows.filter((r) => r.status === "live" || r.status === "hidden").flatMap((r) => [r.path, r.thumb_path]));
  const doomed = objects.filter((o) => !keep.has(o.key) && now.getTime() - Date.parse(o.lastModified) > DAY_MS).map((o) => o.key);
  // A bad read of the rows must never empty the bucket.
  if (objects.length >= 20 && doomed.length > objects.length / 2) {
    return { delete: [] as string[], blocked: `would delete ${doomed.length} of ${objects.length} objects` };
  }
  return { delete: doomed, blocked: null as string | null };
}

export type CleanupDeps = {
  list(): Promise<BucketObject[]>;
  rows(): Promise<PhotoRowRef[]>;
  uploadsThisMonth(): Promise<number>; // photo rows created since the 1st
  remove(key: string): Promise<void>;
  warn(message: string): void;
  now(): Date;
};

export async function runCleanup(deps: CleanupDeps) {
  const [objects, rows, uploads] = await Promise.all([deps.list(), deps.rows(), deps.uploadsThisMonth()]);
  const plan = planCleanup(objects, rows, deps.now());
  if (plan.blocked) deps.warn(`[photos] cleanup blocked: ${plan.blocked}`);
  // ponytail: one DELETE at a time (free on R2); batch with DeleteObjects if runs get long.
  for (const key of plan.delete) await deps.remove(key);

  const gone = new Set(plan.delete);
  const left = objects.filter((o) => !gone.has(o.key));
  const bytes = left.reduce((sum, o) => sum + o.size, 0);
  const writesThisMonth = uploads * 2; // full + thumbnail
  const pct = (used: number, limit: number) => Math.round((used / limit) * 100);
  const warnings: string[] = [];
  if (bytes >= PHOTO_LIMITS.freeTier.bytes * PHOTO_LIMITS.storageWarnRatio) {
    warnings.push(`[photos] storage at ${pct(bytes, PHOTO_LIMITS.freeTier.bytes)}% of the R2 free tier`);
  }
  if (writesThisMonth >= PHOTO_LIMITS.freeTier.writesPerMonth * PHOTO_LIMITS.storageWarnRatio) {
    warnings.push(`[photos] uploads at ${pct(writesThisMonth, PHOTO_LIMITS.freeTier.writesPerMonth)}% of the R2 free tier this month`);
  }
  warnings.forEach((w) => deps.warn(w));
  // The first keys, so a run (or a ?dry=1 check) shows what it touched.
  return { deleted: plan.delete.length, sample: plan.delete.slice(0, 20), blocked: plan.blocked, objects: left.length, bytes, writesThisMonth, warnings };
}
