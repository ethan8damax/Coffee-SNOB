import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import type { PublicProfile, ProfileStats } from "@coffeesnob/supabase";
import { Avatar, Body, ButtonOx, D2, IconCheck, Label } from "@/components/primitives";
import { displayNameFor, formatCount } from "@/lib/profile/profile-helpers";

function Stat({ value, label, last, onPress }: { value: number; label: string; last?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? "link" : undefined}
      accessibilityLabel={`${value} ${label}`}
      style={{ flex: 1, paddingVertical: 12, alignItems: "center", gap: 4, borderRightWidth: last ? 0 : 1, borderRightColor: colors.rule }}
    >
      <Text style={{ fontFamily: "AreaExtended-Black", fontSize: 22, letterSpacing: -0.4, color: colors.ink }}>{formatCount(value)}</Text>
      <Label>{label}</Label>
    </Pressable>
  );
}

function FollowButton({ following, onPress }: { following: boolean; onPress: () => void }) {
  if (!following) return <ButtonOx title="Follow" onPress={onPress} accessibilityRole="button" accessibilityLabel="Follow" style={{ flex: 1 }} />;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Following, tap to unfollow"
      style={{
        flex: 1, height: 46, borderRadius: 2, borderWidth: 1, borderColor: colors.ink, flexDirection: "row",
        alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 18,
      }}
    >
      <IconCheck size={15} />
      <Text style={{ fontFamily: "AreaExtended-Black", fontSize: 10.5, letterSpacing: 1.05, textTransform: "uppercase", color: colors.ink }}>
        Following
      </Text>
    </Pressable>
  );
}

export function ProfileHeader({
  profile,
  stats,
  isOwn,
  signedIn,
  following,
  followFailed,
  onToggleFollow,
}: {
  profile: PublicProfile;
  stats: ProfileStats;
  isOwn: boolean;
  signedIn: boolean;
  following: boolean;
  followFailed: boolean;
  onToggleFollow: () => void;
}) {
  const name = displayNameFor(profile);
  const openPeople = (tab: "followers" | "following") => router.push({ pathname: "/people", params: { id: profile.id, u: profile.username, tab } });

  return (
    <View>
      <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Avatar name={name} size={68} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <D2 numberOfLines={2} accessibilityRole="header" style={{ lineHeight: 36 }}>
              {name}
            </D2>
            <Label style={{ color: colors.ink2, marginTop: 2 }}>@{profile.username}</Label>
          </View>
          {isOwn && (
            <Pressable
              onPress={() => router.push("/settings")}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              hitSlop={8}
              style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}
            >
              <Label style={{ color: colors.ink2, textDecorationLine: "underline" }}>Settings</Label>
            </Pressable>
          )}
        </View>
        {!!profile.bio && <Body style={{ color: colors.ink2 }}>{profile.bio}</Body>}
      </View>

      <View style={{ flexDirection: "row", marginTop: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.rule }}>
        <Stat value={stats.entries} label="Entries" />
        <Stat value={stats.followers} label="Followers" onPress={() => openPeople("followers")} />
        <Stat value={stats.following} label="Following" last onPress={() => openPeople("following")} />
      </View>

      {!isOwn && (
        <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 8 }}>
          <View style={{ flexDirection: "row" }}>
            <FollowButton following={following} onPress={signedIn ? onToggleFollow : () => router.push("/sign-in")} />
          </View>
          {followFailed && <Body style={{ color: colors.burnt }}>Couldn't update that. Try again.</Body>}
        </View>
      )}
    </View>
  );
}
