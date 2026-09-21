import { useEffect, useState } from "react";
import { getShopDetail } from "@coffeesnob/supabase";

// ponytail: effect glue, untested (see useShop). Failure just leaves the
// header without a name — logging doesn't need it.
export function useShopName(shopId: string | null): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    (async () => {
      const { supabase } = require("../supabase");
      const shop = await getShopDetail(supabase, shopId);
      if (!cancelled) setName(shop?.name ?? null);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [shopId]);
  return name;
}
