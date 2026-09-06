import { describe, it, expect } from "vitest";
import { mergeFeedItems } from "./merge-feed-items";
import type { FeedItem } from "./types";

function log(id: string, createdAt: string): FeedItem {
  return {
    type: "log", id, createdAt, userId: "u1", authorName: "Mara K.", shopName: "Noi Coffee",
    shopNeighborhood: null, rating: 4, note: null, likeCount: 0, likedByMe: false, commentCount: 0,
  };
}
function guide(id: string, createdAt: string): FeedItem {
  return { type: "guide", id, createdAt, title: "Six cups", description: null, cityName: "Berlin", shopCount: 6 };
}

describe("mergeFeedItems", () => {
  it("interleaves multiple sources sorted by createdAt descending", () => {
    const result = mergeFeedItems([[log("l1", "2026-09-01T00:00:00Z")], [guide("g1", "2026-09-03T00:00:00Z"), guide("g2", "2026-08-01T00:00:00Z")]]);
    expect(result.map((r) => r.id)).toEqual(["g1", "l1", "g2"]);
  });

  it("returns an empty array when every source is empty", () => {
    expect(mergeFeedItems([[], []])).toEqual([]);
  });
});
