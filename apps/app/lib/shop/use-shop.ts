import { useCallback, useEffect, useState } from "react";
import { getShopDetail, getShopReviews } from "@coffeesnob/supabase";
import type { ShopDetail, ShopReview } from "@coffeesnob/supabase";

export type ShopState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "notfound" }
  | { status: "ready"; shop: ShopDetail; reviews: ShopReview[] };

// ponytail: framework glue (fetch-on-mount/param-change), not unit tested —
// same category as useFollowingFeed. `supabase` is required lazily so importing
// this module doesn't pull in react-native.
export function useShop(shopId: string | undefined) {
  const [state, setState] = useState<ShopState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!shopId) {
      setState({ status: "notfound" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      const { supabase } = require("../supabase");
      const [shop, reviews] = await Promise.all([getShopDetail(supabase, shopId), getShopReviews(supabase, shopId)]);
      if (cancelled) return;
      setState(shop ? { status: "ready", shop, reviews } : { status: "notfound" });
    })().catch(() => {
      if (!cancelled) setState({ status: "error" });
    });
    return () => {
      cancelled = true;
    };
  }, [shopId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
