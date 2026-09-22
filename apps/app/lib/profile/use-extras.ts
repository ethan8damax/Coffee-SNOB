import { useCallback, useEffect, useState } from "react";
import {
  getProfileFaves,
  getProfileVisitDates,
  getSavedShops,
  isShopSaved,
  setShopSaved,
  type ProfileEntry,
  type SavedShop,
} from "@coffeesnob/supabase";
import { heatmapSince } from "./status";

export type Loadable<T> = { status: "idle" | "loading" | "ready" | "error"; data: T | null };

// ponytail: framework glue (fetch-when-enabled), same category as useProfile — not unit tested.
// `supabase` is required lazily so importing this module never pulls in react-native.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useLoad<T>(load: (supabase: any) => Promise<T>, deps: unknown[], enabled = true): Loadable<T> & { retry: () => void } {
  const [state, setState] = useState<Loadable<T>>({ status: "idle", data: null });
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState((s) => ({ status: "loading", data: s.data }));
    const { supabase } = require("../supabase");
    load(supabase).then(
      (data) => !cancelled && setState({ status: "ready", data }),
      () => !cancelled && setState({ status: "error", data: null })
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, key]);
  return { ...state, retry: () => setKey((k) => k + 1) };
}

export const useVisitDates = (userId: string) =>
  useLoad<string[]>((s) => getProfileVisitDates(s as never, userId, heatmapSince(new Date())), [userId]);

export const useFaves = (userId: string, enabled: boolean) => useLoad<ProfileEntry[]>((s) => getProfileFaves(s as never, userId), [userId], enabled);

// The status block's "Top shops" showcase — same query as Faves, just capped to a
// handful for a Letterboxd-style row instead of the full grid.
export const useTopShops = (userId: string, limit = 3) =>
  useLoad<ProfileEntry[]>((s) => getProfileFaves(s as never, userId, limit), [userId, limit]);

export const useSaved = (userId: string, enabled: boolean) => useLoad<SavedShop[]>((s) => getSavedShops(s as never, userId), [userId], enabled);

// Optimistic bookmark toggle for the shop page. Signed-out (userId null) never loads or writes.
export function useShopSaved(userId: string | null, shopId: string) {
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const { supabase } = require("../supabase");
    isShopSaved(supabase, userId, shopId).then((v) => !cancelled && setSaved(v), () => {});
    return () => {
      cancelled = true;
    };
  }, [userId, shopId]);

  const toggle = useCallback(async () => {
    if (!userId) return;
    const next = !saved;
    setSaved(next);
    setFailed(false);
    try {
      const { supabase } = require("../supabase");
      await setShopSaved(supabase, userId, shopId, next);
    } catch {
      setSaved(!next);
      setFailed(true);
    }
  }, [userId, shopId, saved]);

  return { saved, failed, toggle };
}
