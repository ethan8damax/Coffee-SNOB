import { describe, expect, it, vi } from "vitest";
import { decidePhoto, getModerationPhotos, getShopPhotoAdmin, reportPhoto, setShopHeader } from "../src/photo-moderation";

describe("reportPhoto", () => {
  it("files a report and treats a repeat as already reported", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    expect(await reportPhoto({ from: () => ({ insert }) } as any, "p1", "wrong_shop")).toBe("sent");
    expect(insert).toHaveBeenCalledWith({ photo_id: "p1", reason: "wrong_shop" });
    const dup = { from: () => ({ insert: async () => ({ error: { code: "23505", message: "duplicate key" } }) }) } as any;
    expect(await reportPhoto(dup, "p1", "other")).toBe("already");
    const bad = { from: () => ({ insert: async () => ({ error: { code: "42501", message: "rls" } }) }) } as any;
    await expect(reportPhoto(bad, "p1", "other")).rejects.toThrow("rls");
  });
});

describe("decidePhoto / setShopHeader", () => {
  it("calls decide_photo", async () => {
    const rpc = vi.fn(async () => ({ data: 2, error: null }));
    expect(await decidePhoto({ rpc } as any, "p1", "removed")).toBe(2);
    expect(rpc).toHaveBeenCalledWith("decide_photo", { p_photo_id: "p1", p_outcome: "removed" });
  });

  it("pins and unpins", async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    await setShopHeader({ from: () => ({ update }) } as any, "s1", null);
    expect(update).toHaveBeenCalledWith({ header_photo_id: null });
    expect(eq).toHaveBeenCalledWith("id", "s1");
  });
});

describe("getModerationPhotos", () => {
  it("lists hidden photos and photos with open reports, reasons counted, hidden first", async () => {
    const flags = [
      { photo_id: "a", reason: "wrong_shop" },
      { photo_id: "a", reason: "inappropriate" },
      { photo_id: "b", reason: "wrong_shop" },
    ];
    const photos = [
      { id: "a", thumb_path: "a_t.jpg", status: "hidden", created_at: "2026-09-30T10:00:00Z", shop_id: "s1", shops: { name: "Muchacho" }, profiles: { username: "mara" } },
      { id: "b", thumb_path: "b_t.jpg", status: "live", created_at: "2026-09-30T11:00:00Z", shop_id: "s2", shops: { name: "Two Fold" }, profiles: { username: "jo" } },
      { id: "c", thumb_path: "c_t.jpg", status: "hidden", created_at: "2026-09-29T09:00:00Z", shop_id: "s1", shops: { name: "Muchacho" }, profiles: null },
    ];
    const inSpy = vi.fn(async () => ({ data: photos, error: null }));
    const client = {
      from: (t: string) =>
        t === "photo_flags"
          ? { select: () => ({ is: async () => ({ data: flags, error: null }) }) }
          : {
              select: (cols: string) =>
                cols === "id" ? { eq: async () => ({ data: [{ id: "c" }], error: null }) } : { in: inSpy },
            },
    } as any;
    const rows = await getModerationPhotos(client);
    expect(inSpy).toHaveBeenCalledWith("id", ["a", "b", "c"]);
    expect(rows.map((r) => [r.id, r.status, r.reasons])).toEqual([
      ["a", "hidden", { wrong_shop: 1, inappropriate: 1 }],
      ["c", "hidden", {}],
      ["b", "live", { wrong_shop: 1 }],
    ]);
    expect(rows[0]).toMatchObject({ shopId: "s1", shopName: "Muchacho", username: "mara", thumbPath: "a_t.jpg" });
  });
});

describe("getShopPhotoAdmin", () => {
  it("returns the pin and the shop's live photos", async () => {
    const client = {
      from: (t: string) =>
        t === "shops"
          ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { header_photo_id: "p2" }, error: null }) }) }) }
          : { select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [{ id: "p2", path: "x.jpg", thumb_path: "x_t.jpg", width: 1, height: 1, profiles: { username: "mara" } }], error: null }) }) }) }) }) },
    } as any;
    expect(await getShopPhotoAdmin(client, "s1")).toEqual({
      pinnedId: "p2",
      photos: [{ id: "p2", path: "x.jpg", thumbPath: "x_t.jpg", width: 1, height: 1, username: "mara" }],
    });
  });
});
