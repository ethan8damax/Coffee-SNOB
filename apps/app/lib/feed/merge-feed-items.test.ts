import { describe, it, expect } from "vitest";
import { mergeFeedItems } from "./merge-feed-items";
import type { FeedItem } from "./types";

function log(id: string, createdAt: string): FeedItem {
  return {
    type: "log", id, createdAt, userId: "u1", authorName: "Mara K.", shopName: "Noi Coffee",
    shopNeighborhood: null, rating: 4, note: null, likeCount: 0, likedByMe: false, commentCount: 0,
  };
}
function collection(id: string, createdAt: string): FeedItem {
  return { type: "collection", id, createdAt, title: "Tiny bars", description: null, curatorName: "Ines L.", shopCount: 9 };
}

describe("mergeFeedItems", () => {
  it("interleaves multiple sources sorted by createdAt descending", () => {
    const result = mergeFeedItems([[log("l1", "2026-09-01T00:00:00Z")], [collection("c1", "2026-09-03T00:00:00Z"), collection("c2", "2026-08-01T00:00:00Z")]]);
    expect(result.map((r) => r.id)).toEqual(["c1", "l1", "c2"]);
  });

  it("returns an empty array when every source is empty", () => {
    expect(mergeFeedItems([[], []])).toEqual([]);
  });
});
