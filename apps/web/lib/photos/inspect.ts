// The server-side privacy guarantee for uploads (photos spec, section 4): no
// location data leaves the phone. The app re-encodes every photo, which drops
// the camera's metadata; confirm refuses any file that still carries GPS, or
// that isn't a JPEG or WebP at all.
//
// Only location is refused, not EXIF as such: Apple's encoder (iPhone Safari's
// canvas included) writes a small EXIF block into every JPEG it makes, holding
// pixel size and colour space.
export type Inspection = "ok" | "not_image" | "location";

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));
const XMP_GPS = /GPS(Latitude|Longitude)/;

// A TIFF block (the body of EXIF) points to GPS data from IFD0 tag 0x8825.
// Anything unreadable counts as location: refuse rather than guess.
function tiffHasLocation(t: Uint8Array): boolean {
  const le = ascii(t, 0, 2) === "II";
  if (!le && ascii(t, 0, 2) !== "MM") return true;
  const u16 = (o: number) => (le ? t[o] | (t[o + 1] << 8) : (t[o] << 8) | t[o + 1]);
  const u32 = (o: number) => (le ? u16(o) + u16(o + 2) * 0x10000 : u16(o) * 0x10000 + u16(o + 2));
  const ifd = u32(4);
  if (t.length < 8 || ifd + 2 > t.length) return true;
  const count = u16(ifd);
  if (ifd + 2 + count * 12 > t.length) return true;
  for (let k = 0; k < count; k++) if (u16(ifd + 2 + k * 12) === 0x8825) return true;
  return false;
}

const exifHasLocation = (b: Uint8Array) => tiffHasLocation(ascii(b, 0, 6) === "Exif\0\0" ? b.subarray(6) : b);
const xmpHasLocation = (b: Uint8Array) => XMP_GPS.test(new TextDecoder().decode(b));

export function inspectImage(b: Uint8Array): Inspection {
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 4 <= b.length && b[i] === 0xff) {
      const marker = b[i + 1];
      if (marker === 0xda) break; // start of scan: metadata segments all come before it
      const end = i + 2 + ((b[i + 2] << 8) | b[i + 3]);
      if (marker === 0xe1) {
        const payload = b.subarray(i + 4, end);
        if (ascii(payload, 0, 6) === "Exif\0\0" ? exifHasLocation(payload) : xmpHasLocation(payload)) return "location";
      }
      i = end;
    }
    return "ok";
  }
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") {
    // Metadata chunks follow the image data, so walk the whole file.
    for (let i = 12; i + 8 <= b.length; ) {
      const id = ascii(b, i, 4);
      const size = (b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16)) + b[i + 7] * 0x1000000;
      const payload = b.subarray(i + 8, i + 8 + size);
      if ((id === "EXIF" && exifHasLocation(payload)) || (id === "XMP " && xmpHasLocation(payload))) return "location";
      i += 8 + size + (size & 1);
    }
    return "ok";
  }
  return "not_image";
}
