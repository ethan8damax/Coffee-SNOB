export type CommentWithMeta = {
  id: string;
  parentCommentId: string | null;
  userId: string;
  body: string;
  createdAt: string;
  authorName: string;
  likeCount: number;
  likedByMe: boolean;
};

export type CommentThreadItem = CommentWithMeta & { replies: CommentWithMeta[] };

export function buildCommentTree(comments: CommentWithMeta[]): CommentThreadItem[] {
  const repliesByParent = new Map<string, CommentWithMeta[]>();
  for (const c of comments) {
    if (c.parentCommentId === null) continue;
    const replies = repliesByParent.get(c.parentCommentId) ?? [];
    replies.push(c);
    repliesByParent.set(c.parentCommentId, replies);
  }

  return comments
    .filter((c) => c.parentCommentId === null)
    .map((c) => ({
      ...c,
      replies: (repliesByParent.get(c.id) ?? []).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    }));
}
