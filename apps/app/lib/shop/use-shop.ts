import { useCallback, useEffect, useState } from "react";
import { getShopDetail, getShopHeaders, getShopPhotos, getShopReviews } from "@coffeesnob/supabase";
import type { ShopDetail, ShopHeader, ShopPhoto, ShopReview } from "@coffeesnob/supabase";

export type ShopState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "notfound" }
  | { status: "ready"; shop: ShopDetail; reviews: ShopReview[]; header: ShopHeader | null; photos: ShopPhoto[] };

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
      // Photos are extras: if they fail, the page still loads with its fallbacks.
      const [shop, reviews, header, photos] = await Promise.all([
        getShopDetail(supabase, shopId),
        getShopReviews(supabase, shopId),
        getShopHeaders(supabase, [shopId]).then((m) => m.get(shopId) ?? null, () => null),
        getShopPhotos(supabase, shopId).catch((): ShopPhoto[] => []),
      ]);
      if (cancelled) return;
      setState(shop ? { status: "ready", shop, reviews, header, photos } : { status: "notfound" });
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
