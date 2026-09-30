import { PHOTO_LIMITS, type PhotoExt } from "@coffeesnob/supabase";

// Request bodies for /api/photos/sign and /confirm. Ids become object keys, so
// they must be plain UUIDs (no path characters).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTS: PhotoExt[] = ["webp", "jpg"];

type Body = Record<string, unknown>;
const isBody = (b: unknown): b is Body => typeof b === "object" && b !== null;
const isEdge = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= PHOTO_LIMITS.full.longEdge;

export type SignRequest = { logId: string; ext: PhotoExt };
export type ConfirmRequest = SignRequest & { photoId: string; width: number; height: number };

export function parseSign(b: unknown): SignRequest | null {
  if (!isBody(b) || typeof b.logId !== "string" || !UUID.test(b.logId) || !EXTS.includes(b.ext as PhotoExt)) return null;
  return { logId: b.logId, ext: b.ext as PhotoExt };
}

export function parseConfirm(b: unknown): ConfirmRequest | null {
  const sign = parseSign(b);
  if (!sign || !isBody(b) || typeof b.photoId !== "string" || !UUID.test(b.photoId) || !isEdge(b.width) || !isEdge(b.height)) return null;
  return { ...sign, photoId: b.photoId, width: b.width, height: b.height };
}
