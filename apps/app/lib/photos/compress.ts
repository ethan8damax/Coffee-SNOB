import { Platform } from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { PHOTO_LIMITS } from "@coffeesnob/supabase";
import { fitLongEdge } from "./sizes";
import type { CompressedPhoto } from "./upload";

// Both sizes, made on the device (photos spec, section 4). Re-encoding drops
// EXIF, so GPS never leaves the phone; the confirm route checks that too.
// ponytail: manipulateAsync is marked deprecated, but it is a thin wrapper over
// the contextual API, and the SDK 57 typings don't expose `ImageManipulator.manipulate`.
// Swap when the typings catch up.
function render(uri: string, width: number, height: number, longEdge: number, format: SaveFormat, compress: number) {
  return manipulateAsync(uri, [{ resize: fitLongEdge(width, height, longEdge) }], { format, compress });
}

// One full-size decode: the thumbnail is made from the 1600 px result, not the
// original (a 12 MP decode on Safari's main thread is what made Publish stall).
async function encode(uri: string, width: number, height: number, format: SaveFormat, fullQ: number, thumbQ: number) {
  const full = await render(uri, width, height, PHOTO_LIMITS.full.longEdge, format, fullQ);
  const thumb = await render(full.uri, full.width, full.height, PHOTO_LIMITS.thumb.longEdge, format, thumbQ);
  return { full: { uri: full.uri, width: full.width, height: full.height }, thumb: { uri: thumb.uri } };
}

// Safari can't encode WebP from a canvas. Ask once with a 1 px canvas instead of
// failing a full encode on every photo. Native platforms encode WebP.
let webpOnWeb: boolean | null = null;
function canEncodeWebp() {
  if (Platform.OS !== "web") return true;
  if (webpOnWeb === null) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    webpOnWeb = c.toDataURL("image/webp").startsWith("data:image/webp");
  }
  return webpOnWeb;
}

const jpeg = (uri: string, width: number, height: number): Promise<CompressedPhoto> => {
  const q = PHOTO_LIMITS.jpegFallbackQuality;
  return encode(uri, width, height, SaveFormat.JPEG, q, q).then((r) => ({ ext: "jpg", ...r }));
};

export async function compressPhoto(uri: string, width: number, height: number): Promise<CompressedPhoto> {
  if (!canEncodeWebp()) return jpeg(uri, width, height);
  try {
    return { ext: "webp", ...(await encode(uri, width, height, SaveFormat.WEBP, PHOTO_LIMITS.full.quality, PHOTO_LIMITS.thumb.quality)) };
  } catch {
    return jpeg(uri, width, height); // a device whose native encoder lacks WebP
  }
}
