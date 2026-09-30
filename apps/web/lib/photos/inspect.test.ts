import { describe, expect, it } from "vitest";
import { inspectImage } from "./inspect";

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const u8 = (...parts: number[][]) => new Uint8Array(parts.flat());
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
const seg = (marker: number, payload: number[]) => [0xff, marker, ((payload.length + 2) >> 8) & 0xff, (payload.length + 2) & 0xff, ...payload];
const chunk = (id: string, payload: number[]) => [...ascii(id), ...le32(payload.length), ...payload, ...(payload.length % 2 ? [0] : [])];
const riff = (...chunks: number[][]) => {
  const body = [...ascii("WEBP"), ...chunks.flat()];
  return u8(ascii("RIFF"), le32(body.length), body);
};

// A JPEG as a phone writes it: SOI, APP1 Exif with a GPS IFD tag (0x8825), then scan data.
const GPS_EXIF = [...ascii("Exif"), 0, 0, ...ascii("MM"), 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x88, 0x25, 0, 4, 0, 0, 0, 1, 0, 0, 0, 0x1a];
const SOS = seg(0xda, [0, 0, 0]);

describe("inspectImage", () => {
  it("passes a JPEG with no metadata", () => {
    expect(inspectImage(u8([0xff, 0xd8], seg(0xe0, ascii("JFIF\0")), SOS, [1, 2, 3]))).toBe("ok");
  });

  it("refuses a JPEG carrying EXIF (GPS)", () => {
    expect(inspectImage(u8([0xff, 0xd8], seg(0xe0, ascii("JFIF\0")), seg(0xe1, GPS_EXIF), SOS))).toBe("metadata");
  });

  it("ignores Exif-looking bytes after the scan starts", () => {
    expect(inspectImage(u8([0xff, 0xd8], SOS, seg(0xe1, GPS_EXIF)))).toBe("ok");
  });

  it("passes plain lossy and lossless WebP", () => {
    expect(inspectImage(riff(chunk("VP8 ", [1, 2, 3, 4])))).toBe("ok");
    expect(inspectImage(riff(chunk("VP8L", [1, 2, 3, 4])))).toBe("ok");
  });

  it("passes an extended WebP without the EXIF flag, refuses one with it", () => {
    const vp8x = (flags: number) => chunk("VP8X", [flags, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(inspectImage(riff(vp8x(0x10), chunk("VP8 ", [1, 2])))).toBe("ok");
    expect(inspectImage(riff(vp8x(0x08), chunk("VP8 ", [1, 2])))).toBe("metadata");
  });

  it("refuses anything that isn't JPEG or WebP", () => {
    expect(inspectImage(u8([0x89], ascii("PNG\r\n")))).toBe("not_image");
    expect(inspectImage(new Uint8Array())).toBe("not_image");
  });
});
