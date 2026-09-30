// Photo limits and file layout, shared by the app and web. The two caps are
// also hard-coded in supabase/migrations/0038_log_photos.sql; the PGlite test
// (test/photos-sql.test.ts) drives them with these values, so they can't drift.
// Spec: docs/superpowers/specs/2026-09-30-photos-design.md.
export const PHOTO_LIMITS = {
  perLog: 1,
  perUserPerDay: 20,
  full: { longEdge: 1600, quality: 0.7 },
  thumb: { longEdge: 640, quality: 0.65 },
  // iPhone Safari can't encode WebP, so JPEG is the common case on the web app.
  jpegFallbackQuality: 0.65,
  blurhash: { x: 4, y: 3 },
  headerMinShortEdge: 600,
  // Abuse ceilings, not the budget: a 1600 px JPEG from Safari runs ~250-450 KB.
  maxFullBytes: 1_000_000,
  maxThumbBytes: 250_000,
  signedUrlSeconds: 300,
  retryHours: 24,
  flagsToHide: 2,
  storageWarnRatio: 0.7,
} as const;

export type PhotoExt = "webp" | "jpg";

export function photoPaths(logId: string, photoId: string, ext: PhotoExt) {
  const base = `logs/${logId}/${photoId}`;
  return { path: `${base}.${ext}`, thumbPath: `${base}_t.${ext}` };
}

// The only way to build an image URL. The database stores paths, never URLs,
// so moving providers is a base-URL change.
export function photoUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${path}`;
}

export type PhotoRow = { id: string; path: string; thumb_path: string; width: number; height: number; status: string };
export type LogPhoto = { id: string; path: string; thumbPath: string; width: number; height: number };

// RLS also returns the viewer's own hidden photos; only a live one shows on a log.
export function livePhoto(rows: PhotoRow[] | null | undefined): LogPhoto | null {
  const r = rows?.find((p) => p.status === "live");
  return r ? { id: r.id, path: r.path, thumbPath: r.thumb_path, width: r.width, height: r.height } : null;
}
