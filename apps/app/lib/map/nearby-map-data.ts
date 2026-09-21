import { useEffect, useRef, useState } from "react";
import { getRatedShopsInBounds } from "@coffeesnob/supabase";
import { containsBounds, padBounds } from "./bounds";
import type { MapBounds, NearbyShopPin, RatedShopPin } from "../../components/map/types";

const DEBOUNCE_MS = 400;
// Fetch a box this much bigger than the viewport on every side (1 → 3x wide and tall, ~8 mi radius on a phone).
const FETCH_PADDING = 1;

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
export type NearbyStatus = "loading" | "ready" | "error";

export function useNearbyMapData(bounds: MapBounds | null, webAppUrl: string) {
  const [ratedShops, setRatedShops] = useState<RatedShopPin[]>([]);
  const [nearbyShops, setNearbyShops] = useState<NearbyShopPin[]>([]);
  // Status of the OpenStreetMap ("any shop nearby") request — the slow, flaky
  // one. Previously-loaded dots stay on screen while a new request is in flight.
  const [status, setStatus] = useState<NearbyStatus>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ponytail: incrementing counter is enough to discard stale in-flight
  // fetches — no AbortController/cache needed for a debounce-and-discard.
  const requestIdRef = useRef(0);
  // The box we last fetched (viewport + padding). Panning inside it needs no
  // refetch, so the list keeps every café around you, not just the ones on screen.
  const fetchedRef = useRef<MapBounds | null>(null);

  useEffect(() => {
    if (!bounds) return;
    if (fetchedRef.current && containsBounds(fetchedRef.current, bounds)) return;
    setStatus("loading");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      const box = padBounds(bounds, FETCH_PADDING);
      const { supabase } = require("../supabase");
      getRatedShopsInBounds(supabase, box)
        .then((rows) => {
          // A Snob-Approved shop with no editorial_rating set yet and no
          // community logs has rating = null in the view — can't render
          // as a tiered pin, so drop it rather than show a broken value.
          if (requestIdRef.current === requestId) setRatedShops(rows.filter((r) => r.rating != null).map(toRatedShopPin));
        })
        .catch(() => {
          if (requestIdRef.current === requestId) setRatedShops([]);
        });
      fetchNearbyOsmShops(box, webAppUrl)
        .then((shops) => {
          if (requestIdRef.current !== requestId) return;
          fetchedRef.current = box;
          setNearbyShops(shops);
          setStatus("ready");
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) return;
          setNearbyShops([]);
          setStatus("error");
        });
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [bounds, webAppUrl, reloadKey]);

  return { ratedShops, nearbyShops, status, reload: () => {
      fetchedRef.current = null;
      setReloadKey((k) => k + 1);
    } };
}
