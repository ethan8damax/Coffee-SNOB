import { useEffect, useState } from "react";
import { getLiveCityGuides } from "@coffeesnob/supabase";
import type { FeedItem, GuideFeedCard } from "./types";

// ponytail: framework glue (fetch-on-mount), same category as
// useNearbyMapData/useUserLocation — not unit tested. `supabase` is
// required lazily so importing this module doesn't pull in react-native
// (mirrors lib/map/nearby-map-data.ts).
export function useGuidesFeed() {
  const [items, setItems] = useState<GuideFeedCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const { supabase } = require("../supabase");
    getLiveCityGuides(supabase)
      .then((guides) => {
        if (cancelled) return;
        const cards: GuideFeedCard[] = guides.map((g) => ({
          type: "guide",
          id: g.id,
          createdAt: g.created_at,
          title: g.title,
          description: g.description,
          cityName: g.cityName,
          shopCount: (g.list_items as unknown as { count: number }[])[0]?.count ?? 0,
        }));
        setItems(cards);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const feedItems: FeedItem[] = items;
  return { items: feedItems, loading };
}
