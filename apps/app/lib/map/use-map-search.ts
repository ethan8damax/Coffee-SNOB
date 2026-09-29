import { useEffect, useMemo, useState } from "react";
import { searchAddedShops, searchRatedShops } from "@coffeesnob/supabase";
import { dropHidden, dropNearDuplicates, searchIndex } from "./coffee-index";
import { usePlaceHides } from "./place-hides";
import { searchEverywhere, searchNearbyShops } from "./geocode";
import { toAddedPin, toRatedShopPin } from "./nearby-map-data";
import { mergeResults, rankResults, type SearchResult } from "./search-sort";
import type { NearbyShopPin } from "../../components/map/types";

const DEBOUNCE_MS = 350;
const COFFEE_INDEX_URL = process.env.EXPO_PUBLIC_COFFEE_INDEX_URL;

// The map search's fetching: every source lands in stages and the results
// update as each arrives, so our own rated shops show instantly instead of
// waiting on the slowest source. null results = nothing searched yet.
export function useMapSearch(query: string, origin: { lat: number; lng: number } | null, webAppUrl: string) {
  const hidden = usePlaceHides(Boolean(COFFEE_INDEX_URL));
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [pending, setPending] = useState(false);

  // The map re-renders constantly (location fix, fly-to, area loads, pans) and
  // hands a fresh origin object each time. Key the search on the same ~10 km
  // rounding the server's bias uses, so re-renders don't restart the search
  // and repeat searches still share CDN-cached answers.
  const nearKey = origin ? `${origin.lat.toFixed(1)},${origin.lng.toFixed(1)}` : null;
  const near = useMemo(() => {
    if (!nearKey) return null;
    const [lat, lng] = nearKey.split(",").map(Number);
    return { lat, lng };
  }, [nearKey]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setPending(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      const { supabase } = require("../supabase");
      let merged: SearchResult[] = [];
      const add = (incoming: SearchResult[]) => {
        if (cancelled) return;
        merged = mergeResults(merged, incoming);
        setResults(rankResults(merged, q, near));
      };
      // No clearing here: the first stage to land replaces the previous
      // query's list, so it doesn't blank on every keystroke.
      setPending(true);
      // 1. Our rated shops anywhere, by name or city — instant.
      const rated = searchRatedShops(supabase, q)
        .catch((): Awaited<ReturnType<typeof searchRatedShops>> => [])
        .then((rows) => add(rows.map((row): SearchResult => ({ kind: "shop", shop: toRatedShopPin(row), secondary: row.locality }))));
      // 1b. Hand-added shops nobody has rated yet (Add a shop).
      const added = searchAddedShops(supabase, q)
        .catch((): Awaited<ReturnType<typeof searchAddedShops>> => [])
        .then((rows) => add(rows.map((row): SearchResult => ({ kind: "nearby", shop: toAddedPin(row), secondary: row.locality }))));
      // 2. Places and cafés worldwide (Photon), then the coffee index — around
      //    you for the whole query, and around the named city for "muchacho
      //    atlanta" — minus cafés another source already found.
      // Without the index (off in production until the ODbL review), the live
      // OSM name search stands in: slower, but it still catches coffee-serving
      // restaurants and bars Photon's café filter misses.
      const index = (name: string, at: { lat: number; lng: number }) =>
        (COFFEE_INDEX_URL ? searchIndex(name, at, COFFEE_INDEX_URL) : searchNearbyShops(name, at, webAppUrl)).catch((): NearbyShopPin[] => []);
      const wide = searchEverywhere(q, near, webAppUrl)
        .catch((): Awaited<ReturnType<typeof searchEverywhere>> => ({ places: [], shops: [], scoped: null }))
        .then(async ({ places, shops, scoped }) => {
          // ponytail: without the index, skip the slow local search when Photon already found plenty.
          const searchLocal = near && (COFFEE_INDEX_URL || shops.length < 3);
          const [local, there] = await Promise.all([searchLocal ? index(q, near) : [], scoped ? index(scoped.name, scoped.place) : [], rated]);
          const scopedLine = scoped ? [scoped.place.primary, scoped.place.secondary].filter(Boolean).join(", ") : null;
          const found = [...shops.map(({ shop }) => shop), ...merged.flatMap((r) => (r.kind === "place" ? [] : [r.shop]))];
          add([
            ...places.map((place): SearchResult => ({ kind: "place", place })),
            ...shops.map(({ shop, secondary }): SearchResult => ({ kind: "nearby", shop, secondary })),
            ...dropHidden(dropNearDuplicates(local, found), hidden).map((shop): SearchResult => ({ kind: "nearby", shop, secondary: null })),
            ...dropHidden(dropNearDuplicates(there, found), hidden).map((shop): SearchResult => ({ kind: "nearby", shop, secondary: scopedLine })),
          ]);
        });
      Promise.all([rated, added, wide]).then(() => {
        if (!cancelled) setPending(false);
      });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, webAppUrl, near, hidden]);

  return { results, pending };
}
