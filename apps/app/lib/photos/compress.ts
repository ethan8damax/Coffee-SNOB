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

async function encode(uri: string, width: number, height: number, format: SaveFormat, fullQ: number, thumbQ: number) {
  const [full, thumb] = await Promise.all([
    render(uri, width, height, PHOTO_LIMITS.full.longEdge, format, fullQ),
    render(uri, width, height, PHOTO_LIMITS.thumb.longEdge, format, thumbQ),
  ]);
  return { full: { uri: full.uri, width: full.width, height: full.height }, thumb: { uri: thumb.uri } };
}

export async function compressPhoto(uri: string, width: number, height: number): Promise<CompressedPhoto> {
  try {
    return { ext: "webp", ...(await encode(uri, width, height, SaveFormat.WEBP, PHOTO_LIMITS.full.quality, PHOTO_LIMITS.thumb.quality)) };
  } catch {
    // Browsers that can't encode WebP (older Safari) throw; JPEG works everywhere.
    const q = PHOTO_LIMITS.jpegFallbackQuality;
    return { ext: "jpg", ...(await encode(uri, width, height, SaveFormat.JPEG, q, q)) };
  }
}
