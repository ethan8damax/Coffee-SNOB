import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectImage } from "./inspect";

// A JPEG from Apple's ImageIO (`sips -s format jpeg`, a generated 64x48 image with
// no metadata going in). It comes out with an EXIF block anyway: the encoder
// iPhone Safari's canvas uses, and the cause of the first photo being refused.
const APPLE_JPEG = new Uint8Array(readFileSync(join(__dirname, "fixtures/apple-imageio.jpg")));

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const u8 = (...parts: number[][]) => new Uint8Array(parts.flat());
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
const seg = (marker: number, payload: number[]) => [0xff, marker, ((payload.length + 2) >> 8) & 0xff, (payload.length + 2) & 0xff, ...payload];
const chunk = (id: string, payload: number[]) => [...ascii(id), ...le32(payload.length), ...payload, ...(payload.length % 2 ? [0] : [])];
const riff = (...chunks: number[][]) => {
  const body = [...ascii("WEBP"), ...chunks.flat()];
  return u8(ascii("RIFF"), le32(body.length), body);
};

// Big-endian TIFF with one IFD0 entry: `tag`. 0x8825 is the GPS IFD pointer; 0x8769 is
// the Exif sub-IFD (pixel size, colour space) that Apple's encoder writes into every
// JPEG, including iPhone Safari's canvas output.
const tiff = (tag: number) => [...ascii("MM"), 0, 0x2a, 0, 0, 0, 8, 0, 1, tag >> 8, tag & 0xff, 0, 4, 0, 0, 0, 1, 0, 0, 0, 0x1a, 0, 0, 0, 0];
const GPS_TIFF = tiff(0x8825);
const APPLE_TIFF = tiff(0x8769);
const exifSeg = (t: number[]) => seg(0xe1, [...ascii("Exif"), 0, 0, ...t]);
const JFIF = seg(0xe0, ascii("JFIF\0"));
const SOS = seg(0xda, [0, 0, 0]);
const vp8x = (flags: number) => chunk("VP8X", [flags, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("inspectImage", () => {
  it("passes a JPEG with no metadata", () => {
    expect(inspectImage(u8([0xff, 0xd8], JFIF, SOS, [1, 2, 3]))).toBe("ok");
  });

  it("passes Apple's EXIF block, which carries no location", () => {
    expect(inspectImage(u8([0xff, 0xd8], JFIF, exifSeg(APPLE_TIFF), SOS))).toBe("ok");
    expect(inspectImage(APPLE_JPEG)).toBe("ok");
  });

  it("refuses a JPEG whose EXIF has GPS", () => {
    expect(inspectImage(u8([0xff, 0xd8], JFIF, exifSeg(GPS_TIFF), SOS))).toBe("location");
  });

  it("refuses a JPEG with GPS in XMP", () => {
    expect(inspectImage(u8([0xff, 0xd8], seg(0xe1, ascii("http://ns.adobe.com/xap/1.0/\0<x exif:GPSLatitude='33,45N'/>")), SOS))).toBe("location");
  });

  it("refuses EXIF it can't read, rather than guess", () => {
    expect(inspectImage(u8([0xff, 0xd8], exifSeg([...ascii("MM"), 0, 0x2a, 0, 0, 0xff, 0]), SOS))).toBe("location");
  });

  it("ignores Exif-looking bytes after the scan starts", () => {
    expect(inspectImage(u8([0xff, 0xd8], SOS, exifSeg(GPS_TIFF)))).toBe("ok");
  });

  it("passes plain lossy and lossless WebP", () => {
    expect(inspectImage(riff(chunk("VP8 ", [1, 2, 3, 4])))).toBe("ok");
    expect(inspectImage(riff(chunk("VP8L", [1, 2, 3, 4])))).toBe("ok");
  });

  it("reads a WebP's EXIF chunk after the image data: passes without GPS, refuses with it", () => {
    expect(inspectImage(riff(vp8x(0x08), chunk("VP8 ", [1, 2]), chunk("EXIF", APPLE_TIFF)))).toBe("ok");
    expect(inspectImage(riff(vp8x(0x08), chunk("VP8 ", [1, 2]), chunk("EXIF", GPS_TIFF)))).toBe("location");
    expect(inspectImage(riff(vp8x(0x08), chunk("VP8 ", [1, 2]), chunk("EXIF", [...ascii("Exif"), 0, 0, ...GPS_TIFF])))).toBe("location");
  });

  it("refuses a WebP with GPS in XMP", () => {
    expect(inspectImage(riff(vp8x(0x04), chunk("VP8 ", [1, 2]), chunk("XMP ", ascii("<x exif:GPSLongitude='84,23W'/>"))))).toBe("location");
  });

  it("refuses anything that isn't JPEG or WebP", () => {
    expect(inspectImage(u8([0x89], ascii("PNG\r\n")))).toBe("not_image");
    expect(inspectImage(new Uint8Array())).toBe("not_image");
  });
});
