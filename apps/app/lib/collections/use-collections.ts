import { useCallback, useEffect, useState } from "react";
import {
  getCollection,
  getSavedCollections,
  getTopShops,
  getUserCollections,
  isCollectionSaved,
  setCollectionSaved,
  type Collection,
  type CollectionSummary,
  type TopShop,
} from "@coffeesnob/supabase";
import { useLoad } from "../profile/use-extras";

// ponytail: framework glue, like use-extras — not unit tested.
export const useUserCollections = (userId: string, enabled = true) =>
  useLoad<CollectionSummary[]>((s) => getUserCollections(s as never, userId), [userId], enabled);

export const useCollection = (id: string) => useLoad<Collection | null>((s) => getCollection(s as never, id), [id]);

export const useSavedCollections = (userId: string, enabled: boolean) =>
  useLoad<CollectionSummary[]>((s) => getSavedCollections(s as never, userId), [userId], enabled);

export const useTopFour = (userId: string) => useLoad<TopShop[]>((s) => getTopShops(s as never, userId), [userId]);

// Optimistic Save toggle for someone else's collection. Signed out never loads or writes.
export function useCollectionSaved(userId: string | null, listId: string) {
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const { supabase } = require("../supabase");
    isCollectionSaved(supabase, userId, listId).then((v) => !cancelled && setSaved(v), () => {});
    return () => {
      cancelled = true;
    };
  }, [userId, listId]);

  const toggle = useCallback(async () => {
    if (!userId) return;
    const next = !saved;
    setSaved(next);
    setFailed(false);
    try {
      const { supabase } = require("../supabase");
      await setCollectionSaved(supabase, userId, listId, next);
    } catch {
      setSaved(!next);
      setFailed(true);
    }
  }, [userId, listId, saved]);

  return { saved, failed, toggle };
}
