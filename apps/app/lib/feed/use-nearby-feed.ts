import { useEffect, useState } from "react";
import { getShopsInBounds, getLogsForShops, getProfilesByIds, getLogLikes, getCommentCountsByLog } from "@coffeesnob/supabase";
import type { MapBounds } from "../../components/map/types";
import type { FeedItem, LogFeedCard } from "./types";

// ponytail: framework glue (fetch-on-mount/param-change), same category as
// useNearbyMapData/useUserLocation — not unit tested. `supabase` is
// required lazily so importing this module doesn't pull in react-native
// (mirrors lib/map/nearby-map-data.ts).
export function useNearbyFeed(bounds: MapBounds | null, userId: string | null) {
  const [items, setItems] = useState<LogFeedCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bounds) return;
    let cancelled = false;
    setLoading(true);

    async function load() {
      const { supabase } = require("../supabase");
      const shops = await getShopsInBounds(supabase, bounds as MapBounds);
      const shopIds = shops.map((s) => s.id);
      const logs = await getLogsForShops(supabase, shopIds);
      const logIds = logs.map((l) => l.id);

      const [profiles, likes, commentRows] = await Promise.all([
        getProfilesByIds(supabase, [...new Set(logs.map((l) => l.user_id))]),
        getLogLikes(supabase, logIds),
        getCommentCountsByLog(supabase, logIds),
      ]);
      const nameById = new Map(profiles.map((p) => [p.id, p.display_name || p.username]));
      const shopById = new Map(shops.map((s) => [s.id, s]));

      const cards: LogFeedCard[] = logs.map((l) => ({
        type: "log",
        id: l.id,
        createdAt: l.created_at,
        userId: l.user_id,
        authorName: nameById.get(l.user_id) ?? "Someone",
        shopName: shopById.get(l.shop_id)?.name ?? "A shop",
        shopNeighborhood: shopById.get(l.shop_id)?.neighborhood ?? null,
        rating: l.rating,
        note: l.note,
        likeCount: likes.filter((like) => like.log_id === l.id).length,
        likedByMe: likes.some((like) => like.log_id === l.id && like.user_id === userId),
        commentCount: commentRows.filter((c) => c.log_id === l.id).length,
      }));

      if (!cancelled) {
        setItems(cards.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
        setLoading(false);
      }
    }

    load().catch(() => {
      if (!cancelled) {
        setItems([]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [bounds, userId]);

  const feedItems: FeedItem[] = items;
  return { items: feedItems, loading };
}
