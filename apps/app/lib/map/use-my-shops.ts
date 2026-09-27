import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getMyShops } from "@coffeesnob/supabase";
import { toRatedShopPin } from "./nearby-map-data";
import type { MyShops } from "./shop-list";

// Your saved and logged shops for the map's You filter. Loads only while the
// filter is on, and again each time the map regains focus — so a shop you
// just saved or logged elsewhere shows up when you come back.
export function useMyShops(userId: string | null, enabled: boolean): { mine: MyShops | null; failed: boolean } {
  const [mine, setMine] = useState<MyShops | null>(null);
  const [failed, setFailed] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (!userId || !enabled) return;
      let cancelled = false;
      setFailed(false);
      const { supabase } = require("../supabase");
      getMyShops(supabase, userId)
        .then(({ saved, been, rated, unrated }) => {
          if (cancelled) return;
          setMine({
            saved: new Set(saved),
            been: new Set(been),
            rated: rated.map(toRatedShopPin),
            // Logging one goes through its external id, so a shop without one
            // (admin-created, never rated) can't be offered here.
            unrated: unrated.flatMap((s) =>
              s.external_id ? [{ externalId: s.external_id, name: s.name, lat: s.lat, lng: s.lng, address: null, hours: null, website: null, phone: null }] : [],
            ),
          });
        })
        .catch(() => !cancelled && setFailed(true));
      return () => {
        cancelled = true;
      };
    }, [userId, enabled]),
  );
  return { mine: userId ? mine : null, failed };
}
