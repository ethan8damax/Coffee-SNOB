import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPublicProfileByUsername,
  getProfileStats,
  getProfileEntries,
  isFollowing,
  setFollow,
  type PublicProfile,
  type ProfileStats,
  type ProfileEntry,
} from "@coffeesnob/supabase";
import { PAGE_SIZE, hasMoreEntries, withFollowerDelta } from "./profile-helpers";

type Loaded = {
  profile: PublicProfile;
  stats: ProfileStats;
  entries: ProfileEntry[];
  following: boolean;
  hasMore: boolean;
};

export type ProfileState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | ({ status: "ready" } & Loaded);

// ponytail: framework glue (fetch-on-mount + optimistic follow), same category as
// useFollowingFeed — not unit tested; the decisions live in profile-helpers.ts.
// `supabase` is required lazily so importing this module doesn't pull in
// react-native at load time (mirrors lib/feed/use-following-feed.ts).
export function useProfile(username: string, viewerId: string | null) {
  const [state, setState] = useState<ProfileState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const followBusy = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    async function load() {
      const { supabase } = require("../supabase");
      const profile = await getPublicProfileByUsername(supabase, username);
      if (!profile) {
        if (!cancelled) setState({ status: "not-found" });
        return;
      }
      const other = viewerId !== null && viewerId !== profile.id;
      const [stats, entries, following] = await Promise.all([
        getProfileStats(supabase, profile.id),
        getProfileEntries(supabase, profile.id, { limit: PAGE_SIZE }),
        other ? isFollowing(supabase, viewerId, profile.id) : Promise.resolve(false),
      ]);
      if (!cancelled) setState({ status: "ready", profile, stats, entries, following, hasMore: hasMoreEntries(entries.length) });
    }

    load().catch(() => {
      if (!cancelled) setState({ status: "error" });
    });
    return () => {
      cancelled = true;
    };
  }, [username, viewerId, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const loadMore = useCallback(async () => {
    if (state.status !== "ready" || loadingMore) return;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const { supabase } = require("../supabase");
      const next = await getProfileEntries(supabase, state.profile.id, { limit: PAGE_SIZE, offset: state.entries.length });
      setState((s) => (s.status === "ready" ? { ...s, entries: [...s.entries, ...next], hasMore: hasMoreEntries(next.length) } : s));
    } catch {
      setMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }, [state, loadingMore]);

  // Optimistic: flip the button + follower count now, revert if the write fails
  // (same approach as LogCard.toggleLike). Returns false when it reverted.
  const toggleFollow = useCallback(async () => {
    if (state.status !== "ready" || viewerId === null || followBusy.current) return true;
    followBusy.current = true;
    const next = !state.following;
    const targetId = state.profile.id;
    setState((s) => (s.status === "ready" ? { ...s, following: next, stats: withFollowerDelta(s.stats, next) } : s));
    try {
      const { supabase } = require("../supabase");
      await setFollow(supabase, viewerId, targetId, next);
      return true;
    } catch {
      setState((s) => (s.status === "ready" ? { ...s, following: !next, stats: withFollowerDelta(s.stats, !next) } : s));
      return false;
    } finally {
      followBusy.current = false;
    }
  }, [state, viewerId]);

  // After a successful edit, reflect the new name/bio without refetching.
  const applyEdit = useCallback((fields: { displayName: string | null; bio: string | null }) => {
    setState((s) => (s.status === "ready" ? { ...s, profile: { ...s.profile, ...fields } } : s));
  }, []);

  return { state, retry, loadMore, loadingMore, moreFailed, toggleFollow, applyEdit };
}
