import { describe, expect, it, vi } from "vitest";
import { getProfileEntries, getShopHeaders, getShopPhotos } from "../src/queries";

describe("getShopHeaders", () => {
  it("maps rows by shop, camelCased", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ shop_id: "s1", photo_id: "p1", path: "logs/l/p1.jpg", thumb_path: "logs/l/p1_t.jpg", width: 1600, height: 1200, username: "mara", pinned: false }],
      error: null,
    }));
    const headers = await getShopHeaders({ rpc } as any, ["s1", "s2"]);
    expect(rpc).toHaveBeenCalledWith("shop_headers", { p_shop_ids: ["s1", "s2"] });
    expect(headers.get("s1")).toEqual({ id: "p1", path: "logs/l/p1.jpg", thumbPath: "logs/l/p1_t.jpg", width: 1600, height: 1200, username: "mara", pinned: false });
    expect(headers.has("s2")).toBe(false);
  });

  it("skips the call for no shops", async () => {
    const rpc = vi.fn();
    expect((await getShopHeaders({ rpc } as any, [])).size).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("getShopPhotos", () => {
  it("returns the shop's live photos with their authors", async () => {
    const eq = vi.fn(() => ({ eq, order: () => ({ limit: async () => ({ data: [{ id: "p1", path: "a.jpg", thumb_path: "a_t.jpg", width: 1200, height: 1600, profiles: { username: "mara" } }], error: null }) }) }));
    const client = { from: () => ({ select: () => ({ eq }) }) } as any;
    expect(await getShopPhotos(client, "s1")).toEqual([{ id: "p1", path: "a.jpg", thumbPath: "a_t.jpg", width: 1200, height: 1600, username: "mara" }]);
    expect(eq).toHaveBeenCalledWith("status", "live");
  });
});

describe("getProfileEntries photos", () => {
  const log = (id: string, shop: string, photos: unknown[]) => ({
    id, shop_id: shop, rating: 4, note: null, drink: null, visited_at: "2026-09-30", created_at: "2026-09-30T10:00:00Z",
    shops: { name: "Shop", neighborhood: null }, log_photos: photos,
  });
  const own = { id: "own", path: "o.jpg", thumb_path: "o_t.jpg", width: 1200, height: 1600, status: "live" };

  it("uses the entry's own photo, else the shop's header, else none", async () => {
    const rows = [log("l1", "s1", [own]), log("l2", "s2", []), log("l3", "s3", [{ ...own, status: "hidden" }])];
    const range = async () => ({ data: rows, error: null });
    const rpc = vi.fn(async () => ({
      data: [{ shop_id: "s2", photo_id: "h2", path: "h.jpg", thumb_path: "h_t.jpg", width: 1600, height: 1200, username: "jo", pinned: false }],
      error: null,
    }));
    const client = { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ order: () => ({ range }) }) }) }) }), rpc } as any;
    const entries = await getProfileEntries(client, "u1");
    expect(rpc).toHaveBeenCalledWith("shop_headers", { p_shop_ids: ["s2", "s3"] });
    expect(entries.map((e) => e.photo?.thumbPath ?? null)).toEqual(["o_t.jpg", "h_t.jpg", null]);
  });
});
