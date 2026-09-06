import { useEffect, useState } from "react";
import {
  getFollowedUserIds,
  getFollowingFeedLogs,
  getFollowingFeedLists,
  getProfilesByIds,
  getCitiesByIds,
  getLogLikes,
  getCommentCountsByLog,
} from "@coffeesnob/supabase";
import { mergeFeedItems } from "./merge-feed-items";
import type { FeedItem, LogFeedCard, GuideFeedCard, CollectionFeedCard } from "./types";

// ponytail: framework glue (fetch-on-mount/param-change), same category as
// useNearbyMapData/useUserLocation — not unit tested, per this codebase's
// established split between tested pure logic and untested RN/effect glue.
// `supabase` is required lazily so importing this module doesn't pull in
// react-native (mirrors lib/map/nearby-map-data.ts).
export function useFollowingFeed(userId: string | null) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    async function load() {
      const { supabase } = require("../supabase");
      const followeeIds = await getFollowedUserIds(supabase, userId as string);
      const [logs, lists] = await Promise.all([
        getFollowingFeedLogs(supabase, followeeIds),
        getFollowingFeedLists(supabase, followeeIds),
      ]);

      const logIds = logs.map((l) => l.id);
      const curatorIds = lists.map((l) => l.curator_id).filter((id): id is string => id !== null);
      const cityIds = lists.map((l) => l.city_id).filter((id): id is string => id !== null);
      const actorIds = [...new Set([...logs.map((l) => l.user_id), ...curatorIds])];

      const [profiles, cities, likes, commentRows] = await Promise.all([
        getProfilesByIds(supabase, actorIds),
        getCitiesByIds(supabase, [...new Set(cityIds)]),
        getLogLikes(supabase, logIds),
        getCommentCountsByLog(supabase, logIds),
      ]);
      const nameById = new Map(profiles.map((p) => [p.id, p.display_name || p.username]));
      const cityNameById = new Map(cities.map((c) => [c.id, c.name]));

      const logCards: LogFeedCard[] = logs.map((l) => ({
        type: "log",
        id: l.id,
        createdAt: l.created_at,
        userId: l.user_id,
        authorName: nameById.get(l.user_id) ?? "Someone",
        shopName: (l.shops as { name: string } | null)?.name ?? "A shop",
        shopNeighborhood: (l.shops as { neighborhood: string | null } | null)?.neighborhood ?? null,
        rating: l.rating,
        note: l.note,
        likeCount: likes.filter((like) => like.log_id === l.id).length,
        likedByMe: likes.some((like) => like.log_id === l.id && like.user_id === userId),
        commentCount: commentRows.filter((c) => c.log_id === l.id).length,
      }));

      const listCards: (GuideFeedCard | CollectionFeedCard)[] = lists.map((l) => {
        const shopCount = (l.list_items as unknown as { count: number }[])[0]?.count ?? 0;
        if (l.type === "city_guide") {
          return {
            type: "guide",
            id: l.id,
            createdAt: l.created_at,
            title: l.title,
            description: l.description,
            cityName: l.city_id ? (cityNameById.get(l.city_id) ?? null) : null,
            shopCount,
          };
        }
        return {
          type: "collection",
          id: l.id,
          createdAt: l.created_at,
          title: l.title,
          description: l.description,
          curatorName: l.curator_id ? (nameById.get(l.curator_id) ?? "The desk") : "The desk",
          shopCount,
        };
      });

      if (!cancelled) {
        setItems(mergeFeedItems([logCards, listCards]));
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
  }, [userId]);

  return { items, loading };
}
