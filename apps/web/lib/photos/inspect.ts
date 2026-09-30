// The server-side privacy guarantee for uploads (photos spec, section 4): the
// phone re-encodes to drop EXIF (and with it GPS), and confirm refuses any file
// that still carries it, or that isn't a JPEG or WebP at all. Reads only the
// first bytes of the file: JPEG metadata segments come before the scan, and a
// WebP declares EXIF in its leading VP8X header.
export type Inspection = "ok" | "not_image" | "metadata";

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));

export function inspectImage(b: Uint8Array): Inspection {
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 4 <= b.length && b[i] === 0xff) {
      const marker = b[i + 1];
      if (marker === 0xda) break; // start of scan: no metadata segments after this
      if (marker === 0xe1 && ascii(b, i + 4, 6) === "Exif\0\0") return "metadata";
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
    return "ok";
  }
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") {
    // Only the extended format (VP8X first) can hold EXIF; its flags byte says so.
    if (ascii(b, 12, 4) === "VP8X") return b[20] & 0x08 ? "metadata" : "ok";
    return "ok";
  }
  return "not_image";
}
