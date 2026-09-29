import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, View, useWindowDimensions } from "react-native";
import { Tap } from "@/components/tap";
import { router, useFocusEffect } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/build/react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@coffeesnob/design-tokens";
import { Body, ButtonLine, ButtonOx, Label } from "@/components/primitives";
import { isDesktopWidth } from "@/lib/nav";
import { PROFILE_MAX_WIDTH, gridColumns } from "@/lib/profile/profile-helpers";
import { useProfile } from "@/lib/profile/use-profile";
import { useSaved } from "@/lib/profile/use-extras";
import { useSavedCollections, useUserCollections } from "@/lib/collections/use-collections";
import type { CollectionSummary } from "@coffeesnob/supabase";
import { AddToCollection } from "@/components/collections/add-to-collection";
import { EntryTile } from "./entry-tile";
import { ProfileHeader } from "./profile-header";
import { StatusBlock } from "./status-block";
import { AddedShopsLink } from "../add-shop/added-shops-link";

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


type Tab = "Entries" | "Collections" | "Faves";

function TabStrip({ tabs, tab, counts, onChange }: { tabs: Tab[]; tab: Tab; counts: Partial<Record<Tab, number>>; onChange: (t: Tab) => void }) {
  return (
    <View accessibilityRole="tablist" style={{ marginTop: 22, flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.rule }}>
      {tabs.map((t) => (
        <Tap
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
        </Tap>
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

function CollectionRow({ c, showPrivacy }: { c: CollectionSummary; showPrivacy: boolean }) {
  const meta = [`${c.shopCount} ${c.shopCount === 1 ? "café" : "cafés"}`, showPrivacy && !c.isPublic ? "Private" : null].filter(Boolean).join(" · ");
  return (
    <Tap feedback="tint"
      onPress={() => router.push(`/collection/${c.id}`)}
      accessibilityRole="link"
      accessibilityLabel={`${c.title}, ${meta}`}
      style={{ minHeight: 56, justifyContent: "center", gap: 3, borderBottomWidth: 1, borderBottomColor: colors.rule2, paddingVertical: 10 }}
    >
      <Body style={{ fontFamily: "Area-Bold", color: colors.ink }}>{c.title}</Body>
      <Label>{meta}</Label>
    </Tap>
  );
}

function CollectionsTab({ userId, isOwn }: { userId: string; isOwn: boolean }) {
  const lists = useUserCollections(userId);
  const [creating, setCreating] = useState(false);
  const create = isOwn ? (
    <View style={{ paddingTop: 16, paddingBottom: 4 }}>
      <ButtonLine title="New collection" onPress={() => setCreating(true)} accessibilityRole="button" accessibilityLabel="New collection" style={{ alignSelf: "flex-start" }} />
      {creating ? (
        <AddToCollection
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            router.push(`/collection/${id}`);
          }}
        />
      ) : null}
    </View>
  ) : null;
  if (lists.status === "error") return <Note onRetry={lists.retry}>{"Couldn't load collections."}</Note>;
  if (!lists.data) return <ActivityIndicator color={colors.oxblood} style={{ padding: 32 }} />;
  return (
    <View style={{ paddingHorizontal: 16 }}>
      {create}
      {lists.data.length === 0 ? (
        <Note>{isOwn ? "Make a list: a trip, a wishlist, your regulars." : "No public collections yet."}</Note>
      ) : (
        lists.data.map((c) => <CollectionRow key={c.id} c={c} showPrivacy={isOwn} />)
      )}
    </View>
  );
}

// Faves: what someone saved, shops and other people's collections. Shown to
// visitors only when the owner turns it on in Settings.
function FavesTab({ userId, isOwn, isPublic }: { userId: string; isOwn: boolean; isPublic: boolean }) {
  const shops = useSaved(userId, true);
  const lists = useSavedCollections(userId, true);
  if (shops.status === "error" || lists.status === "error") {
    return (
      <Note
        onRetry={() => {
          shops.retry();
          lists.retry();
        }}
      >
        {"Couldn't load faves."}
      </Note>
    );
  }
  if (!shops.data || !lists.data) return <ActivityIndicator color={colors.oxblood} style={{ padding: 32 }} />;
  const empty = shops.data.length === 0 && lists.data.length === 0;
  return (
    <View style={{ paddingHorizontal: 16 }}>
      {isOwn ? (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", paddingTop: 14, flexWrap: "wrap" }}>
          <Label>{isPublic ? "Anyone can see this." : "Only you can see this."}</Label>
          <Tap onPress={() => router.push("/settings")} accessibilityRole="link" hitSlop={8}>
            <Label style={{ color: colors.oxblood }}>Change in Settings</Label>
          </Tap>
        </View>
      ) : null}
      {empty ? (
        <Note>{isOwn ? "Nothing saved. Save shops and collections to keep them here." : "Nothing saved yet."}</Note>
      ) : null}
      {lists.data.length ? (
        <View style={{ marginTop: 18 }}>
          <Label style={{ color: colors.ink }}>Collections</Label>
          {lists.data.map((c) => <CollectionRow key={c.id} c={c} showPrivacy={false} />)}
        </View>
      ) : null}
      {shops.data.length ? (
        <View style={{ marginTop: 18 }}>
          <Label style={{ color: colors.ink }}>Shops</Label>
          {shops.data.map((sh) => (
            <Tap feedback="tint"
              key={sh.shopId}
              onPress={() => router.push(`/shop/${sh.shopId}`)}
              accessibilityRole="link"
              accessibilityLabel={sh.name}
              style={{ minHeight: 56, justifyContent: "center", gap: 3, borderBottomWidth: 1, borderBottomColor: colors.rule2, paddingVertical: 10 }}
            >
              <Body style={{ fontFamily: "Area-Bold", color: colors.ink }}>{sh.name}</Body>
              {sh.neighborhood ? <Label>{sh.neighborhood}</Label> : null}
            </Tap>
          ))}
        </View>
      ) : null}
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

        <StatusBlock userId={profile.id} entries={total} isOwn={isOwn} />
        {isOwn ? <AddedShopsLink userId={profile.id} /> : null}

        <TabStrip
          tabs={isOwn || profile.favesPublic ? ["Entries", "Collections", "Faves"] : ["Entries", "Collections"]}
          tab={tab}
          counts={{ Entries: stats.entries }}
          onChange={setTab}
        />

        {tab === "Collections" && <CollectionsTab userId={profile.id} isOwn={isOwn} />}
        {tab === "Faves" && (isOwn || profile.favesPublic) && <FavesTab userId={profile.id} isOwn={isOwn} isPublic={profile.favesPublic} />}

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
