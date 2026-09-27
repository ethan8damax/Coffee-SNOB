import { describe, expect, it, vi } from "vitest";
import { addToCollection, ensureShop, getTopShops, toCollectionSummary } from "../src/collections";

describe("collections queries", () => {
  it("maps a list row with its item count", () => {
    expect(toCollectionSummary({ id: "l1", title: "London", description: null, is_public: true, save_count: 3, curator_id: "u1", created_at: "t", list_items: [{ count: 7 }] }))
      .toEqual({ id: "l1", title: "London", description: null, isPublic: true, saveCount: 3, ownerId: "u1", shopCount: 7, createdAt: "t" });
  });

  it("adds a shop and ignores it if it's already there", async () => {
    const upsert = vi.fn(() => Promise.resolve({ error: null }));
    await addToCollection({ from: () => ({ upsert }) } as any, "l1", "s1");
    expect(upsert).toHaveBeenCalledWith({ list_id: "l1", shop_id: "s1" }, { onConflict: "list_id,shop_id", ignoreDuplicates: true });
  });

  it("ensureShop sends the place and returns the shop id", async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: "shop-1", error: null }));
    expect(await ensureShop({ rpc } as any, { externalId: "cs_aaaaaaaaaaaa", name: "Perc", lat: 1, lng: 2, address: "12 Main" })).toBe("shop-1");
    expect(rpc).toHaveBeenCalledWith("ensure_shop", expect.objectContaining({ p_external_id: "cs_aaaaaaaaaaaa", p_name: "Perc", p_lat: 1, p_lng: 2, p_address: "12 Main" }));
  });

  it("getTopShops returns filled slots in slot order", async () => {
    const rows = [{ slot: 3, shop_id: "s3", shops: { name: "C" } }, { slot: 1, shop_id: "s1", shops: { name: "A" } }];
    const order = vi.fn(() => Promise.resolve({ data: rows, error: null }));
    const client = { from: () => ({ select: () => ({ eq: () => ({ order }) }) }) } as any;
    expect(await getTopShops(client, "u1")).toEqual([{ slot: 3, shopId: "s3", name: "C" }, { slot: 1, shopId: "s1", name: "A" }]);
  });
});
