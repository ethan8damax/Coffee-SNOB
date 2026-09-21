import { useState } from "react";
import { ActivityIndicator, ScrollView, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { Body, ButtonLine, ButtonOx, Label } from "@/components/primitives";
import { isDesktopWidth } from "@/lib/nav";
import { PROFILE_MAX_WIDTH, gridColumns } from "@/lib/profile/profile-helpers";
import { useProfile } from "@/lib/profile/use-profile";
import { EntryTile } from "./entry-tile";
import { ProfileHeader } from "./profile-header";

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16, backgroundColor: colors.paper }}>{children}</View>;
}

const message = { textAlign: "center", color: colors.ink3, maxWidth: 260 } as const;

export function ProfileView({ username, viewerId }: { username: string; viewerId: string | null }) {
  const { state, retry, loadMore, loadingMore, moreFailed, toggleFollow, applyEdit } = useProfile(username, viewerId);
  const { width } = useWindowDimensions();
  const [followFailed, setFollowFailed] = useState(false);

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
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ alignItems: "center", paddingBottom: 40 }}>
      <View style={{ width: "100%", maxWidth: isDesktopWidth(width) ? PROFILE_MAX_WIDTH : undefined }}>
        <ProfileHeader
          profile={profile}
          stats={stats}
          isOwn={isOwn}
          signedIn={viewerId !== null}
          following={following}
          followFailed={followFailed}
          onToggleFollow={onToggleFollow}
          onEdited={applyEdit}
        />

        <View style={{ marginTop: 22, flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.rule }}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: colors.ink, marginBottom: -1 }}>
            <Label accessibilityRole="header" style={{ color: colors.ink }}>
              Entries {stats.entries}
            </Label>
          </View>
        </View>

        {entries.length === 0 ? (
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
        )}
      </View>
    </ScrollView>
  );
}
