import { describe, expect, it } from "vitest";
import { PHOTO_LIMITS, photoPaths, photoUrl } from "../src/photos";

const LOG = "11111111-1111-4111-8111-111111111111";
const PHOTO = "22222222-2222-4222-8222-222222222222";

describe("photoPaths", () => {
  it("puts both sizes under the log, named by photo id", () => {
    expect(photoPaths(LOG, PHOTO, "webp")).toEqual({
      path: `logs/${LOG}/${PHOTO}.webp`,
      thumbPath: `logs/${LOG}/${PHOTO}_t.webp`,
    });
  });

  it("follows the format for the JPEG fallback", () => {
    expect(photoPaths(LOG, PHOTO, "jpg").thumbPath).toBe(`logs/${LOG}/${PHOTO}_t.jpg`);
  });
});

describe("photoUrl", () => {
  it("joins base and path with exactly one slash", () => {
    expect(photoUrl("https://photos.example.com", "logs/a/b.webp")).toBe("https://photos.example.com/logs/a/b.webp");
    expect(photoUrl("https://photos.example.com//", "logs/a/b.webp")).toBe("https://photos.example.com/logs/a/b.webp");
  });
});

describe("PHOTO_LIMITS", () => {
  it("keeps the thumbnail smaller than the full size", () => {
    expect(PHOTO_LIMITS.thumb.longEdge).toBeLessThan(PHOTO_LIMITS.full.longEdge);
    expect(PHOTO_LIMITS.headerMinShortEdge).toBeLessThanOrEqual(PHOTO_LIMITS.full.longEdge);
  });
});
