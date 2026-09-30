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

async function ok(res: Response, step: string) {
  if (!res.ok) throw new Error(`${step} failed (${res.status})`);
  return res;
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

  const signed = (await (await ok(await post("/api/photos/sign", { logId, ext: photo.ext }), "sign")).json()) as {
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
  await ok(await post("/api/photos/confirm", { logId, photoId: signed.photoId, ext: photo.ext, width, height }), "confirm");
}
