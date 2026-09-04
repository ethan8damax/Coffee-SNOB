import { useEffect, useRef, useState } from "react";
import { getRatedShopsInBounds } from "@coffeesnob/supabase";
import type { MapBounds, NearbyShopPin, RatedShopPin } from "../../components/map/types";

const DEBOUNCE_MS = 400;

export async function fetchNearbyOsmShops(bounds: MapBounds, webAppUrl: string): Promise<NearbyShopPin[]> {
  const params = new URLSearchParams({
    minLat: String(bounds.minLat),
    minLng: String(bounds.minLng),
    maxLat: String(bounds.maxLat),
    maxLng: String(bounds.maxLng),
  });
  const response = await fetch(`${webAppUrl}/api/nearby-shops?${params}`);
  if (!response.ok) throw new Error(`nearby-shops request failed: ${response.status}`);
  const { shops } = (await response.json()) as { shops: NearbyShopPin[] };
  return shops;
}

type RatedShopRow = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  neighborhood: string | null;
  is_snob_approved: boolean;
  tag: string | null;
  price_tier: string | null;
  rating: number | null;
  log_count: number;
};

export function toRatedShopPin(row: RatedShopRow): RatedShopPin {
  return {
    id: row.id,
    name: row.name,
    lat: row.lat!,
    lng: row.lng!,
    neighborhood: row.neighborhood,
    isSnobApproved: row.is_snob_approved,
    tag: row.tag,
    priceTier: row.price_tier,
    rating: row.rating!,
    logCount: row.log_count,
  };
}

// ponytail: debounce/fetch-on-bounds-change wiring only — the pure
// fetch/mapping functions above are what's unit tested; this hook is
// framework glue (useState/useEffect/setTimeout), not branching logic.
// `supabase` is required lazily (mirrors lib/directions.ts) so importing
// this module never pulls in react-native — that's what let the tests
// above run under vitest with no RN transform.
export function useNearbyMapData(bounds: MapBounds | null, webAppUrl: string) {
  const [ratedShops, setRatedShops] = useState<RatedShopPin[]>([]);
  const [nearbyShops, setNearbyShops] = useState<NearbyShopPin[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ponytail: incrementing counter is enough to discard stale in-flight
  // fetches — no AbortController/cache needed for a debounce-and-discard.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!bounds) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      const { supabase } = require("../supabase");
      getRatedShopsInBounds(supabase, bounds)
        .then((rows) => {
          if (requestIdRef.current === requestId) setRatedShops(rows.map(toRatedShopPin));
        })
        .catch(() => {
          if (requestIdRef.current === requestId) setRatedShops([]);
        });
      fetchNearbyOsmShops(bounds, webAppUrl)
        .then((shops) => {
          if (requestIdRef.current === requestId) setNearbyShops(shops);
        })
        .catch(() => {
          if (requestIdRef.current === requestId) setNearbyShops([]);
        });
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [bounds, webAppUrl]);

  return { ratedShops, nearbyShops };
}
