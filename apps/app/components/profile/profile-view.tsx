import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/build/react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@coffeesnob/design-tokens";
import { Body, ButtonLine, ButtonOx, Label } from "@/components/primitives";
import { isDesktopWidth } from "@/lib/nav";
import { PROFILE_MAX_WIDTH, gridColumns } from "@/lib/profile/profile-helpers";
import { useProfile } from "@/lib/profile/use-profile";
import { useFaves, useSaved } from "@/lib/profile/use-extras";
import { EntryTile } from "./entry-tile";
import { ProfileHeader } from "./profile-header";
import { StatusBlock } from "./status-block";

function Centered({ children }: { children: React.ReactNode }) {
  // See sign-in-prompt.tsx: the custom tab bar isn't auto-excluded from scene
  // content, so centering needs the real tab bar height to center within the
  // actually-visible area, not the full screen height (which the bar covers part of).
  const tabBarHeight = useBottomTabBarHeight();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, paddingBottom: 24 + tabBarHeight, gap: 16, backgroundColor: colors.paper }}>
      {children}
    </View>
  );
}

const message = { textAlign: "center", color: colors.ink3, maxWidth: 260 } as const;


type Tab = "Entries" | "Faves" | "Saved";

function TabStrip({ tabs, tab, counts, onChange }: { tabs: Tab[]; tab: Tab; counts: Partial<Record<Tab, number>>; onChange: (t: Tab) => void }) {
  return (
    <View accessibilityRole="tablist" style={{ marginTop: 22, flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.rule }}>
      {tabs.map((t) => (
        <Pressable
          key={t}
          onPress={() => onChange(t)}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === t }}
          style={{
            flex: 1,
            alignItems: "center",
            paddingVertical: 12,
            minHeight: 44,
            borderBottomWidth: 2,
            borderBottomColor: tab === t ? colors.ink : "transparent",
            marginBottom: -1,
          }}
        >
          <Label style={{ color: tab === t ? colors.ink : colors.ink3 }}>
            {t}
            {counts[t] !== undefined ? ` ${counts[t]}` : ""}
          </Label>
        </Pressable>
      ))}
    </View>
  );
}

function Note({ children, onRetry }: { children: string; onRetry?: () => void }) {
  return (
    <View style={{ alignItems: "center", padding: 32, gap: 16 }}>
      <Body style={message}>{children}</Body>
      {onRetry && <ButtonLine title="Try again" onPress={onRetry} accessibilityRole="button" accessibilityLabel="Try again" />}
    </View>
  );
}

function FavesTab({ userId, isOwn, columns }: { userId: string; isOwn: boolean; columns: number }) {
  const faves = useFaves(userId, true);
  if (faves.status === "error") return <Note onRetry={faves.retry}>Couldn't load faves.</Note>;
  if (!faves.data) return <ActivityIndicator color={colors.oxblood} style={{ padding: 32 }} />;
  if (faves.data.length === 0) return <Note>{isOwn ? "Faves are your 4 and 5 verdicts. Nothing here yet." : "No faves yet."}</Note>;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", paddingTop: 1 }}>
      {faves.data.map((e, i) => (
        <EntryTile key={e.id} entry={e} index={i} total={faves.data!.length} columns={columns} />
      ))}
    </View>
  );
}

function SavedTab({ userId }: { userId: string }) {
  const saved = useSaved(userId, true);
  if (saved.status === "error") return <Note onRetry={saved.retry}>Couldn't load your saved shops.</Note>;
  if (!saved.data) return <ActivityIndicator color={colors.oxblood} style={{ padding: 32 }} />;
  if (saved.data.length === 0) return <Note>Nothing saved. Tap Save on a shop page to keep it for later.</Note>;
  return (
    <View style={{ paddingHorizontal: 16 }}>
      {saved.data.map((s) => (
        <Pressable
          key={s.shopId}
          onPress={() => router.push(`/shop/${s.shopId}`)}
          accessibilityRole="link"
          accessibilityLabel={s.name}
          style={{ minHeight: 56, justifyContent: "center", gap: 3, borderBottomWidth: 1, borderBottomColor: colors.rule2, paddingVertical: 10 }}
        >
          <Body style={{ fontFamily: "Area-Bold", color: colors.ink }}>{s.name}</Body>
          {s.neighborhood ? <Label>{s.neighborhood}</Label> : null}
        </Pressable>
      ))}
    </View>
  );
}

export function ProfileView({ username, viewerId }: { username: string; viewerId: string | null }) {
  const { state, retry, loadMore, loadingMore, moreFailed, toggleFollow, refresh } = useProfile(username, viewerId);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [followFailed, setFollowFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("Entries");

  // Silent (no spinner) — picks up a display name/bio change made on the
  // Settings screen without a jarring reload every time you switch back here.
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  if (state.status === "loading") {
    return (
      <Centered>
        <ActivityIndicator color={colors.oxblood} />
      </Centered>
    );
  }
  if (state.status === "not-found") {
    return (
      <Centered>
        <Body style={message}>No one by that name.</Body>
      </Centered>
    );
  }
  if (state.status === "error") {
    return (
      <Centered>
        <Body style={message}>Couldn't load this profile.</Body>
        <ButtonLine title="Try again" onPress={retry} accessibilityRole="button" accessibilityLabel="Try loading this profile again" />
      </Centered>
    );
  }

  const { profile, stats, entries, following, hasMore } = state;
  const isOwn = viewerId !== null && viewerId === profile.id;
  const columns = gridColumns(width);
  // Stats can lag a fresh log by a beat; never number below the rows we hold.
  const total = Math.max(stats.entries, entries.length);

  async function onToggleFollow() {
    setFollowFailed(!(await toggleFollow()));
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      // paddingTop for the status bar (this screen starts content at the top, unlike
      // the centered empty states above, so it needs the real inset directly).
      // paddingBottom for the real tab bar height, not a guessed fixed value — the
      // last row of entries was otherwise scrollable-but-hidden behind the bar.
      contentContainerStyle={{ alignItems: "center", paddingTop: insets.top, paddingBottom: 40 + tabBarHeight }}
    >
      <View style={{ width: "100%", maxWidth: isDesktopWidth(width) ? PROFILE_MAX_WIDTH : undefined }}>
        <ProfileHeader
          profile={profile}
          stats={stats}
          isOwn={isOwn}
          signedIn={viewerId !== null}
          following={following}
          followFailed={followFailed}
          onToggleFollow={onToggleFollow}
        />

        <StatusBlock userId={profile.id} entries={total} />

        <TabStrip tabs={isOwn ? ["Entries", "Faves", "Saved"] : ["Entries", "Faves"]} tab={tab} counts={{ Entries: stats.entries }} onChange={setTab} />

        {tab === "Faves" && <FavesTab userId={profile.id} isOwn={isOwn} columns={columns} />}
        {tab === "Saved" && isOwn && <SavedTab userId={profile.id} />}

        {tab === "Entries" &&
          (entries.length === 0 ? (
          <View style={{ alignItems: "center", padding: 32, gap: 16 }}>
            <Body style={message}>{isOwn ? "Nothing logged yet. Go find somewhere worth the trip." : "Nothing logged yet."}</Body>
            {isOwn && <ButtonOx title="Log your first visit" onPress={() => router.push("/map")} accessibilityRole="button" accessibilityLabel="Log your first visit" />}
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", paddingTop: 1 }}>
              {entries.map((e, i) => (
                <EntryTile key={e.id} entry={e} index={i} total={total} columns={columns} />
              ))}
            </View>
            {hasMore && (
              <View style={{ alignItems: "center", padding: 20, gap: 10 }}>
                {moreFailed && <Body style={{ color: colors.burnt }}>Couldn't load more. Try again.</Body>}
                <ButtonLine
                  title={loadingMore ? "Loading" : "Load more"}
                  onPress={loadMore}
                  disabled={loadingMore}
                  accessibilityRole="button"
                  accessibilityLabel="Load more entries"
                />
              </View>
            )}
          </>
        ))}
      </View>
    </ScrollView>
  );
}
