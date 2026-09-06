import { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { getComments, getCommentLikes, getProfilesByIds, postComment, setCommentLike } from "@coffeesnob/supabase";
import { Avatar, BodySm, Label } from "../primitives";
import { buildCommentTree, type CommentWithMeta } from "../../lib/feed/comment-tree";

export function CommentThread({ logId, userId, onCountChange }: { logId: string; userId: string; onCountChange?: (count: number) => void }) {
  const [comments, setComments] = useState<CommentWithMeta[] | null>(null);
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled).catch(() => {
      if (!cancelled) setComments([]);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logId]);

  async function load(isCancelled: () => boolean) {
    const { supabase } = require("../../lib/supabase");
    const rows = await getComments(supabase, logId);
    const commentIds = rows.map((r) => r.id);
    const [profiles, likes] = await Promise.all([
      getProfilesByIds(supabase, [...new Set(rows.map((r) => r.user_id))]),
      getCommentLikes(supabase, commentIds),
    ]);
    const nameById = new Map(profiles.map((p) => [p.id, p.display_name || p.username]));
    if (isCancelled()) return;
    const mapped = rows.map((r) => ({
      id: r.id,
      parentCommentId: r.parent_comment_id,
      userId: r.user_id,
      body: r.body,
      createdAt: r.created_at,
      authorName: nameById.get(r.user_id) ?? "Someone",
      likeCount: likes.filter((l) => l.comment_id === r.id).length,
      likedByMe: likes.some((l) => l.comment_id === r.id && l.user_id === userId),
    }));
    setComments(mapped);
    onCountChange?.(mapped.length);
  }

  async function toggleLike(comment: CommentWithMeta) {
    const nextLiked = !comment.likedByMe;
    setComments((prev) =>
      (prev ?? []).map((c) => (c.id === comment.id ? { ...c, likedByMe: nextLiked, likeCount: c.likeCount + (nextLiked ? 1 : -1) } : c))
    );
    try {
      const { supabase } = require("../../lib/supabase");
      await setCommentLike(supabase, comment.id, userId, nextLiked);
    } catch {
      setComments((prev) =>
        (prev ?? []).map((c) => (c.id === comment.id ? { ...c, likedByMe: !nextLiked, likeCount: c.likeCount + (nextLiked ? -1 : 1) } : c))
      );
    }
  }

  async function submit(parentCommentId: string | null) {
    const body = draft.trim();
    if (!body) return;
    const { supabase } = require("../../lib/supabase");
    try {
      const row = await postComment(supabase, { logId, userId, body, parentCommentId: parentCommentId ?? undefined });
      const newComment = { id: row.id, parentCommentId: row.parent_comment_id, userId: row.user_id, body: row.body, createdAt: row.created_at, authorName: "You", likeCount: 0, likedByMe: false };
      setComments((prev) => {
        const next = [...(prev ?? []), newComment];
        onCountChange?.(next.length);
        return next;
      });
      setDraft("");
      setReplyingTo(null);
    } catch {
      // Leave draft/replyingTo as-is so the user can retry — no logging
      // convention exists elsewhere in this app yet, matching the silent-
      // fail pattern already used by the feed hooks.
    }
  }

  if (comments === null) {
    return (
      <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.rule2, alignItems: "center" }}>
        <ActivityIndicator color={colors.ink3} />
      </View>
    );
  }

  const tree = buildCommentTree(comments);

  return (
    <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.rule2, gap: 12 }}>
      {tree.map((c) => (
        <View key={c.id} style={{ gap: 10 }}>
          <CommentRow comment={c} indent={0} onLike={() => toggleLike(c)} onReply={() => setReplyingTo(replyingTo === c.id ? null : c.id)} />
          {c.replies.map((r) => (
            <CommentRow key={r.id} comment={r} indent={31} onLike={() => toggleLike(r)} />
          ))}
          {replyingTo === c.id && (
            <ComposeRow value={draft} onChange={setDraft} onSubmit={() => submit(c.id)} indent={31} placeholder={`Reply to ${c.authorName.split(" ")[0]}…`} />
          )}
        </View>
      ))}
      {replyingTo === null && <ComposeRow value={draft} onChange={setDraft} onSubmit={() => submit(null)} indent={0} placeholder="Add a comment…" />}
    </View>
  );
}

function CommentRow({ comment, indent, onLike, onReply }: { comment: CommentWithMeta; indent: number; onLike: () => void; onReply?: () => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 9, alignItems: "flex-start", marginLeft: indent }}>
      <Avatar name={comment.authorName} size={indent ? 19 : 22} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Label style={{ color: colors.ink }}>{comment.authorName}</Label>
        </View>
        <BodySm style={{ marginTop: 4 }}>{comment.body}</BodySm>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 7 }}>
          <Pressable onPress={onLike} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ color: comment.likedByMe ? colors.burnt : colors.ink3, fontSize: 12 }}>♥</Text>
            <Label style={{ color: comment.likedByMe ? colors.burnt : colors.ink3 }}>{String(comment.likeCount)}</Label>
          </Pressable>
          {onReply && (
            <Pressable onPress={onReply}>
              <Label style={{ color: colors.ink3 }}>Reply</Label>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function ComposeRow({ value, onChange, onSubmit, indent, placeholder }: { value: string; onChange: (v: string) => void; onSubmit: () => void; indent: number; placeholder: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 9, alignItems: "center", marginLeft: indent }}>
      <Avatar name="You" size={indent ? 19 : 22} />
      <View style={{ flex: 1, height: indent ? 30 : 34, borderWidth: 1, borderColor: colors.rule, borderRadius: 17, paddingHorizontal: 12, justifyContent: "center" }}>
        <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.ink3} onSubmitEditing={onSubmit} style={{ fontSize: 12, color: colors.ink }} />
      </View>
      <Pressable onPress={onSubmit}>
        <Label style={{ color: value.trim() ? colors.tealDk : colors.ink3 }}>Post</Label>
      </Pressable>
    </View>
  );
}
