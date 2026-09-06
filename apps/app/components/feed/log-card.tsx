import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { setLogLike } from "@coffeesnob/supabase";
import { Avatar, Body, Label, D2 } from "../primitives";
import { Detour } from "../detour";
import { CommentThread } from "./comment-thread";
import type { LogFeedCard } from "../../lib/feed/types";

export function LogCard({ item, userId }: { item: LogFeedCard; userId: string }) {
  const [liked, setLiked] = useState(item.likedByMe);
  const [likeCount, setLikeCount] = useState(item.likeCount);
  const [commentsOpen, setCommentsOpen] = useState(false);

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      const { supabase } = require("../../lib/supabase");
      await setLogLike(supabase, item.id, userId, next);
    } catch {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    }
  }

  return (
    <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.rule2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <Avatar name={item.authorName} size={26} />
        <Label style={{ color: colors.ink3 }}>Logged by</Label>
        <Label style={{ color: colors.ink }}>{item.authorName}</Label>
      </View>

      <D2>{item.shopName}</D2>
      {item.shopNeighborhood && <Label style={{ color: colors.ink3, marginTop: 6 }}>{item.shopNeighborhood}</Label>}
      <View style={{ marginTop: 11 }}>
        <Detour value={item.rating} />
      </View>
      {item.note && <Body style={{ marginTop: 10 }}>{item.note}</Body>}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginTop: 14 }}>
        <Pressable onPress={toggleLike} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Text style={{ color: liked ? colors.burnt : colors.ink2 }}>♥</Text>
          <Label style={{ color: colors.ink2 }}>{String(likeCount)}</Label>
        </Pressable>
        <Pressable onPress={() => setCommentsOpen((o) => !o)} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Text style={{ color: commentsOpen ? colors.ink : colors.ink2 }}>💬</Text>
          <Label style={{ color: colors.ink2 }}>{String(item.commentCount)}</Label>
        </Pressable>
        <Text style={{ color: colors.ink3 }}>🔖 Save</Text>
      </View>

      {commentsOpen && <CommentThread logId={item.id} userId={userId} />}
    </View>
  );
}
