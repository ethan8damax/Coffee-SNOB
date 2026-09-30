import { beforeEach, describe, expect, it, vi } from "vitest";
import { PHOTO_LIMITS } from "@coffeesnob/supabase";
import { handleConfirm, handleSign, type PhotoDeps, type PhotoStore } from "./handlers";

const LOG = "11111111-1111-4111-8111-111111111111";
const PHOTO = "22222222-2222-4222-8222-222222222222";
const USER = { id: "u1" };
const FULL = `logs/${LOG}/${PHOTO}.webp`;
const THUMB = `logs/${LOG}/${PHOTO}_t.webp`;
const CLEAN_WEBP = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBPVP8 ")]);
const EXIF_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 8, ...Buffer.from("Exif\0\0")]);

let store: PhotoStore;
let deps: PhotoDeps;
let objects: Map<string, number>;

beforeEach(() => {
  objects = new Map([[FULL, 150_000], [THUMB, 30_000]]);
  store = {
    isActive: vi.fn(async () => true),
    ownsLog: vi.fn(async () => true),
    photosOnLog: vi.fn(async () => 0),
    photosToday: vi.fn(async () => 0),
    insertPhoto: vi.fn(async () => ({ ok: true as const })),
  };
  deps = {
    userFromToken: vi.fn(async (t: string) => (t === "good" ? USER : null)),
    store: () => store,
    newId: () => PHOTO,
    r2: {
      presignPut: vi.fn(async (key: string) => `https://r2.test/${key}?sig`),
      head: vi.fn(async (key: string) => (objects.has(key) ? { size: objects.get(key)!, contentType: "image/webp" } : null)),
      readStart: vi.fn(async () => CLEAN_WEBP),
      remove: vi.fn(async () => {}),
    },
  };
});

describe("handleSign", () => {
  it("returns a photo id and two upload URLs", async () => {
    expect(await handleSign(deps, "good", { logId: LOG, ext: "webp" })).toEqual({
      status: 200,
      body: { photoId: PHOTO, fullUrl: `https://r2.test/${FULL}?sig`, thumbUrl: `https://r2.test/${THUMB}?sig` },
    });
    expect(deps.r2.presignPut).toHaveBeenCalledWith(FULL, "image/webp");
  });

  it("signs JPEG uploads as image/jpeg", async () => {
    await handleSign(deps, "good", { logId: LOG, ext: "jpg" });
    expect(deps.r2.presignPut).toHaveBeenCalledWith(`logs/${LOG}/${PHOTO}.jpg`, "image/jpeg");
  });

  it("refuses when signed out, suspended, not their log, or over a cap", async () => {
    expect((await handleSign(deps, "bad", { logId: LOG, ext: "webp" })).status).toBe(401);
    expect((await handleSign(deps, "good", { logId: "x", ext: "webp" })).status).toBe(400);
    vi.mocked(store.isActive).mockResolvedValueOnce(false);
    expect((await handleSign(deps, "good", { logId: LOG, ext: "webp" })).status).toBe(403);
    vi.mocked(store.ownsLog).mockResolvedValueOnce(false);
    expect((await handleSign(deps, "good", { logId: LOG, ext: "webp" })).status).toBe(404);
    vi.mocked(store.photosOnLog).mockResolvedValueOnce(PHOTO_LIMITS.perLog);
    expect((await handleSign(deps, "good", { logId: LOG, ext: "webp" })).status).toBe(409);
    vi.mocked(store.photosToday).mockResolvedValueOnce(PHOTO_LIMITS.perUserPerDay);
    expect((await handleSign(deps, "good", { logId: LOG, ext: "webp" })).status).toBe(429);
    expect(deps.r2.presignPut).not.toHaveBeenCalled();
  });
});

describe("handleConfirm", () => {
  const body = { logId: LOG, photoId: PHOTO, ext: "webp", width: 1600, height: 1200 };

  it("checks the files and inserts the row", async () => {
    expect(await handleConfirm(deps, "good", body)).toEqual({
      status: 200,
      body: { photo: { id: PHOTO, path: FULL, thumbPath: THUMB, width: 1600, height: 1200 } },
    });
    expect(store.insertPhoto).toHaveBeenCalledWith({ id: PHOTO, log_id: LOG, user_id: "u1", path: FULL, thumb_path: THUMB, width: 1600, height: 1200 });
    expect(deps.r2.remove).not.toHaveBeenCalled();
    expect(deps.r2.readStart).toHaveBeenCalledWith(FULL, 150_000);
  });

  it("refuses a missing upload and cleans up", async () => {
    objects.delete(THUMB);
    expect((await handleConfirm(deps, "good", body)).status).toBe(400);
    expect(deps.r2.remove).toHaveBeenCalledWith(FULL);
    expect(store.insertPhoto).not.toHaveBeenCalled();
  });

  it("refuses files over the size limits", async () => {
    objects.set(FULL, PHOTO_LIMITS.maxFullBytes + 1);
    expect((await handleConfirm(deps, "good", body)).status).toBe(413);
    expect(deps.r2.remove).toHaveBeenCalledWith(THUMB);
  });

  it("refuses a file that still carries location, and deletes it", async () => {
    vi.mocked(deps.r2.readStart).mockResolvedValueOnce(EXIF_JPEG);
    expect((await handleConfirm(deps, "good", body)).status).toBe(422);
    expect(deps.r2.remove).toHaveBeenCalledWith(FULL);
    expect(store.insertPhoto).not.toHaveBeenCalled();
  });

  it("cleans up when the database refuses the row", async () => {
    vi.mocked(store.insertPhoto).mockResolvedValueOnce({ ok: false, message: "This log already has a photo" });
    expect(await handleConfirm(deps, "good", body)).toEqual({ status: 409, body: { error: "This log already has a photo" } });
    expect(deps.r2.remove).toHaveBeenCalledTimes(2);
  });

  it("refuses when signed out or not their log, before touching storage", async () => {
    expect((await handleConfirm(deps, "bad", body)).status).toBe(401);
    vi.mocked(store.ownsLog).mockResolvedValueOnce(false);
    expect((await handleConfirm(deps, "good", body)).status).toBe(404);
    expect(deps.r2.head).not.toHaveBeenCalled();
  });
});
