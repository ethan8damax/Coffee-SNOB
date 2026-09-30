import { PHOTO_LIMITS, photoPaths, type PhotoExt } from "@coffeesnob/supabase";
import { inspectImage } from "./inspect";
import { parseConfirm, parseSign } from "./requests";
import type { R2 } from "./r2";

// The logic behind /api/photos/sign and /confirm (photos Phase 1 spec, section 2),
// with storage and the database injected so it's testable without either.

export type PhotoStore = {
  isActive(userId: string): Promise<boolean>;
  ownsLog(userId: string, logId: string): Promise<boolean>;
  photosOnLog(logId: string): Promise<number>; // not removed
  photosToday(userId: string): Promise<number>; // last 24 hours
  insertPhoto(row: {
    id: string; log_id: string; user_id: string; path: string; thumb_path: string; width: number; height: number;
  }): Promise<{ ok: true } | { ok: false; message: string }>;
};

export type PhotoDeps = {
  userFromToken(token: string): Promise<{ id: string } | null>;
  store(token: string): PhotoStore;
  r2: Pick<R2, "presignPut" | "head" | "readStart" | "remove">;
  newId(): string;
};

export type Result = { status: number; body: Record<string, unknown> };
const fail = (status: number, error: string): Result => ({ status, body: { error } });
const CONTENT_TYPE: Record<PhotoExt, string> = { webp: "image/webp", jpg: "image/jpeg" };

// Signed in, a well-formed body, active, and it's their log. Returns what the
// handler needs, or a refusal.
async function authorize<T extends { logId: string }>(deps: PhotoDeps, token: string, req: T | null) {
  const user = await deps.userFromToken(token);
  if (!user) return fail(401, "Sign in to add a photo.");
  if (!req) return fail(400, "Bad request.");
  const store = deps.store(token);
  if (!(await store.isActive(user.id))) return fail(403, "This account can't add photos right now.");
  if (!(await store.ownsLog(user.id, req.logId))) return fail(404, "That entry isn't yours.");
  return { user, store, req };
}

export async function handleSign(deps: PhotoDeps, token: string, body: unknown): Promise<Result> {
  const auth = await authorize(deps, token, parseSign(body));
  if ("status" in auth) return auth;
  const { req } = auth;
  if ((await auth.store.photosOnLog(req.logId)) >= PHOTO_LIMITS.perLog) return fail(409, "This entry already has a photo.");
  if ((await auth.store.photosToday(auth.user.id)) >= PHOTO_LIMITS.perUserPerDay) return fail(429, "That's plenty of photos for today.");

  const photoId = deps.newId();
  const { path, thumbPath } = photoPaths(req.logId, photoId, req.ext);
  const [fullUrl, thumbUrl] = await Promise.all([
    deps.r2.presignPut(path, CONTENT_TYPE[req.ext]),
    deps.r2.presignPut(thumbPath, CONTENT_TYPE[req.ext]),
  ]);
  return { status: 200, body: { photoId, fullUrl, thumbUrl } };
}

export async function handleConfirm(deps: PhotoDeps, token: string, body: unknown): Promise<Result> {
  const auth = await authorize(deps, token, parseConfirm(body));
  if ("status" in auth) return auth;
  const { req } = auth;

  const { path, thumbPath } = photoPaths(req.logId, req.photoId, req.ext);
  const discard = async (result: Result) => {
    await Promise.all([deps.r2.remove(path), deps.r2.remove(thumbPath)]);
    return result;
  };

  const [full, thumb] = await Promise.all([deps.r2.head(path), deps.r2.head(thumbPath)]);
  if (!full || !thumb) return discard(fail(400, "The upload didn't finish."));
  if (full.size > PHOTO_LIMITS.maxFullBytes || thumb.size > PHOTO_LIMITS.maxThumbBytes) {
    console.warn("[photos] refused: too big", { ext: req.ext, full: full.size, thumb: thumb.size });
    return discard(fail(413, "That photo is too big."));
  }
  // The whole file (already capped by the size check): WebP keeps metadata at the end.
  const inspection = inspectImage(await deps.r2.readStart(path, full.size));
  if (inspection !== "ok") {
    console.warn("[photos] refused:", inspection, { ext: req.ext, full: full.size });
    return discard(fail(422, "That photo couldn't be used."));
  }

  const inserted = await auth.store.insertPhoto({
    id: req.photoId, log_id: req.logId, user_id: auth.user.id, path, thumb_path: thumbPath, width: req.width, height: req.height,
  });
  if (!inserted.ok) return discard(fail(409, inserted.message));
  return { status: 200, body: { photo: { id: req.photoId, path, thumbPath, width: req.width, height: req.height } } };
}
