import { useCallback, useEffect, useState } from "react";
import { getCityShops } from "@coffeesnob/supabase";
import { toRatedShopPin } from "../map/nearby-map-data";
import type { RatedShopPin } from "../../components/map/types";

export type CityState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; shops: RatedShopPin[]; locality: string | null; region: string | null };

// ponytail: fetch-on-mount glue, same category as useShop.
export function useCity(key: string | undefined) {
  const [state, setState] = useState<CityState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!key) {
      setState({ status: "ready", shops: [], locality: null, region: null });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    const { supabase } = require("../supabase");
    getCityShops(supabase, key)
      .then((rows) => {
        if (cancelled) return;
        setState({ status: "ready", shops: rows.map(toRatedShopPin), locality: rows[0]?.locality ?? null, region: rows[0]?.region ?? null });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
