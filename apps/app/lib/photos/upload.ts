import type { PhotoExt } from "@coffeesnob/supabase";

// One photo's trip: ask the web app for signed URLs, PUT both sizes straight to
// the bucket, then confirm (photos Phase 1 spec, section 2). No react-native
// imports, so it runs under Vitest; `fetchImpl` also reads the local file URIs.
export type CompressedPhoto = {
  ext: PhotoExt;
  full: { uri: string; width: number; height: number };
  thumb: { uri: string };
};

const CONTENT_TYPE: Record<PhotoExt, string> = { webp: "image/webp", jpg: "image/jpeg" };

// Our server said no for good (not theirs, over a cap, refused file): retrying
// won't change the answer. 401 (session refresh), 429 and 5xx are worth retrying.
export class PhotoRefused extends Error {
  constructor(readonly status: number) {
    super(`Photo refused (${status})`);
  }
}
const RETRYABLE = new Set([401, 408, 429]);

async function ok(res: Response, step: string) {
  if (!res.ok) throw new Error(`${step} failed (${res.status})`);
  return res;
}

async function ours(res: Response, step: string) {
  if (res.status >= 400 && res.status < 500 && !RETRYABLE.has(res.status)) throw new PhotoRefused(res.status);
  return ok(res, step);
}

export async function uploadLogPhoto({
  apiBase,
  token,
  logId,
  photo,
  fetchImpl = fetch,
}: {
  apiBase: string;
  token: string;
  logId: string;
  photo: CompressedPhoto;
  fetchImpl?: typeof fetch;
}) {
  const post = (path: string, body: object) =>
    fetchImpl(`${apiBase}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  const signed = (await (await ours(await post("/api/photos/sign", { logId, ext: photo.ext }), "sign")).json()) as {
    photoId: string;
    fullUrl: string;
    thumbUrl: string;
  };
  const [full, thumb] = await Promise.all([photo.full.uri, photo.thumb.uri].map(async (uri) => (await fetchImpl(uri)).blob()));
  const type = CONTENT_TYPE[photo.ext];
  await Promise.all([
    fetchImpl(signed.fullUrl, { method: "PUT", headers: { "content-type": type }, body: full }).then((r) => ok(r, "upload")),
    fetchImpl(signed.thumbUrl, { method: "PUT", headers: { "content-type": type }, body: thumb }).then((r) => ok(r, "upload")),
  ]);
  const { width, height } = photo.full;
  await ours(await post("/api/photos/confirm", { logId, photoId: signed.photoId, ext: photo.ext, width, height }), "confirm");
}
