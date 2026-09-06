import { describe, it, expect } from "vitest";
import { buildCommentTree, type CommentWithMeta } from "./comment-tree";

function comment(overrides: Partial<CommentWithMeta>): CommentWithMeta {
  return {
    id: "c1", parentCommentId: null, userId: "u1", body: "hi", createdAt: "2026-09-01T00:00:00Z",
    authorName: "Mara K.", likeCount: 0, likedByMe: false, ...overrides,
  };
}

describe("buildCommentTree", () => {
  it("nests a reply under its parent", () => {
    const top = comment({ id: "c1" });
    const reply = comment({ id: "c2", parentCommentId: "c1", createdAt: "2026-09-01T01:00:00Z" });

    const tree = buildCommentTree([top, reply]);

    expect(tree).toEqual([{ ...top, replies: [reply] }]);
  });

  it("orders replies to the same parent oldest first", () => {
    const top = comment({ id: "c1" });
    const replyLater = comment({ id: "c3", parentCommentId: "c1", createdAt: "2026-09-01T02:00:00Z" });
    const replyEarlier = comment({ id: "c2", parentCommentId: "c1", createdAt: "2026-09-01T01:00:00Z" });

    const tree = buildCommentTree([top, replyLater, replyEarlier]);

    expect(tree[0].replies.map((r) => r.id)).toEqual(["c2", "c3"]);
  });

  it("gives a top-level comment with no replies an empty replies array", () => {
    const top = comment({ id: "c1" });
    expect(buildCommentTree([top])).toEqual([{ ...top, replies: [] }]);
  });

  it("preserves top-level order as given", () => {
    const first = comment({ id: "c1" });
    const second = comment({ id: "c2" });
    expect(buildCommentTree([first, second]).map((c) => c.id)).toEqual(["c1", "c2"]);
  });
});
