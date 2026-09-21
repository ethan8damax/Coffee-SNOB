import { useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { updateProfile, type PublicProfile, type ProfileStats } from "@coffeesnob/supabase";
import { Avatar, Body, ButtonLine, ButtonOx, D2, IconCheck, Label } from "@/components/primitives";
import { useAuth } from "@/context/auth";
import { BIO_MAX, NAME_MAX, displayNameFor, formatCount, normalizeEdit, remaining } from "@/lib/profile/profile-helpers";

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

const input = {
  borderWidth: 1,
  borderColor: colors.rule,
  backgroundColor: colors.card,
  borderRadius: 2,
  paddingHorizontal: 12,
  paddingVertical: 10,
  minHeight: 44,
  fontFamily: "Area-Regular",
  fontSize: 14,
  color: colors.ink,
} as const;

function EditForm({
  profile,
  onDone,
  onSaved,
}: {
  profile: PublicProfile;
  onDone: () => void;
  onSaved: (f: { displayName: string | null; bio: string | null }) => void;
}) {
  const { refreshProfile } = useAuth();
  const [name, setName] = useState(profile.displayName ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const parsed = normalizeEdit({ displayName: name, bio });

  async function save() {
    if (!parsed.ok || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      const { supabase } = require("@/lib/supabase");
      await updateProfile(supabase, profile.id, parsed.fields);
      onSaved(parsed.fields);
      await refreshProfile();
      onDone();
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }

  const bioLeft = remaining(bio, BIO_MAX);
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <Label>Display name</Label>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={NAME_MAX}
          placeholder={profile.username}
          placeholderTextColor={colors.ink3}
          accessibilityLabel="Display name"
          style={input}
        />
      </View>
      <View style={{ gap: 6 }}>
        <Label>Bio</Label>
        <TextInput
          value={bio}
          onChangeText={setBio}
          multiline
          placeholder="What you drink, where you stand."
          placeholderTextColor={colors.ink3}
          accessibilityLabel="Bio"
          style={[input, { minHeight: 96, textAlignVertical: "top" }]}
        />
        <Label style={{ color: bioLeft < 0 ? colors.burnt : colors.ink3 }}>{bioLeft} characters left</Label>
      </View>
      {failed && <Body style={{ color: colors.burnt }}>Couldn't save that. Try again.</Body>}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <ButtonOx
          title={saving ? "Saving" : "Save"}
          onPress={save}
          disabled={!parsed.ok || saving}
          accessibilityRole="button"
          accessibilityLabel="Save profile"
          style={{ flex: 1, opacity: !parsed.ok || saving ? 0.5 : 1 }}
        />
        <ButtonLine title="Cancel" onPress={onDone} disabled={saving} accessibilityRole="button" accessibilityLabel="Cancel editing" style={{ flex: 1 }} />
      </View>
    </View>
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
  onEdited,
}: {
  profile: PublicProfile;
  stats: ProfileStats;
  isOwn: boolean;
  signedIn: boolean;
  following: boolean;
  followFailed: boolean;
  onToggleFollow: () => void;
  onEdited: (f: { displayName: string | null; bio: string | null }) => void;
}) {
  const { signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const name = displayNameFor(profile);
  const openPeople = (tab: "followers" | "following") => router.push({ pathname: "/people", params: { id: profile.id, u: profile.username, tab } });

  return (
    <View>
      <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 14 }}>
        <Label style={{ color: colors.ink2 }}>@{profile.username}</Label>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Avatar name={name} size={68} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <D2 numberOfLines={2} accessibilityRole="header" style={{ lineHeight: 36 }}>
              {name}
            </D2>
          </View>
        </View>
        {editing ? (
          <EditForm profile={profile} onDone={() => setEditing(false)} onSaved={onEdited} />
        ) : (
          !!profile.bio && <Body style={{ color: colors.ink2 }}>{profile.bio}</Body>
        )}
      </View>

      <View style={{ flexDirection: "row", marginTop: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.rule }}>
        <Stat value={stats.entries} label="Entries" />
        <Stat value={stats.followers} label="Followers" onPress={() => openPeople("followers")} />
        <Stat value={stats.following} label="Following" last onPress={() => openPeople("following")} />
      </View>

      {!editing && (
        <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 8 }}>
          {isOwn ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ButtonLine title="Edit profile" onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Edit profile" style={{ flex: 1 }} />
              <Pressable
                onPress={() => router.push({ pathname: "/people", params: { id: profile.id, u: profile.username, tab: "find" } })}
                accessibilityRole="button"
                accessibilityLabel="Find people"
                style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" }}
              >
                <Label style={{ color: colors.ink2, textDecorationLine: "underline" }}>Find people</Label>
              </Pressable>
              <Pressable
                onPress={signOut}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" }}
              >
                <Label style={{ color: colors.ink2, textDecorationLine: "underline" }}>Sign out</Label>
              </Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: "row" }}>
              <FollowButton following={following} onPress={signedIn ? onToggleFollow : () => router.push("/sign-in")} />
            </View>
          )}
          {followFailed && <Body style={{ color: colors.burnt }}>Couldn't update that. Try again.</Body>}
        </View>
      )}
    </View>
  );
}
