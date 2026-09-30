import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Switch, View } from "react-native";
import { Tap } from "@/components/tap";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { getPublicProfileByUsername, setFavesPublic, type PublicProfile } from "@coffeesnob/supabase";
import { Body, BodySm, ButtonLine, IconBack, Label } from "@/components/primitives";
import { useAuth } from "@/context/auth";
import { EditProfileForm } from "@/components/profile/edit-profile-form";

// Own-account management: edit profile + sign out. Reached from a "Settings"
// link on your own profile header (find-people lives at the Followers/
// Following stats instead — no separate entry point needed for it here).
const TELL_US = [
  { about: "bug", label: "Report a bug" },
  { about: "idea", label: "Suggest something" },
  { about: "contact", label: "Contact us" },
] as const;

export default function SettingsScreen() {
  const { profile: authProfile, signOut } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [favesFailed, setFavesFailed] = useState(false);

  // Optimistic: flip now, put it back if the write fails.
  async function toggleFaves(next: boolean) {
    if (!profile) return;
    setProfile({ ...profile, favesPublic: next });
    setFavesFailed(false);
    try {
      const { supabase } = require("@/lib/supabase");
      await setFavesPublic(supabase, profile.id, next);
    } catch {
      setProfile({ ...profile, favesPublic: !next });
      setFavesFailed(true);
    }
  }
  const back = () => (router.canGoBack() ? router.back() : router.replace("/profile"));

  useEffect(() => {
    if (!authProfile) return;
    let cancelled = false;
    const { supabase } = require("@/lib/supabase");
    getPublicProfileByUsername(supabase, authProfile.username).then(
      (p) => !cancelled && setProfile(p),
      () => !cancelled && setFailed(true)
    );
    return () => {
      cancelled = true;
    };
  }, [authProfile]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ alignItems: "center", paddingBottom: 40 }}>
      <View style={{ width: "100%", maxWidth: 640 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
          <Tap onPress={back} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 44, height: 44, marginLeft: -12, alignItems: "center", justifyContent: "center" }}>
            <IconBack />
          </Tap>
          <Label accessibilityRole="header" style={{ color: colors.ink2 }}>
            Settings
          </Label>
        </View>

        <View style={{ padding: 16, gap: 20 }}>
          {editing && profile ? (
            <EditProfileForm profile={profile} onDone={() => setEditing(false)} />
          ) : failed ? (
            <View style={{ alignItems: "center", padding: 32, gap: 16 }}>
              <Body style={{ color: colors.ink3 }}>Couldn't load your profile.</Body>
            </View>
          ) : !profile ? (
            <ActivityIndicator color={colors.oxblood} style={{ padding: 32 }} />
          ) : (
            <>
              <ButtonLine title="Edit profile" onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Edit profile" style={{ alignSelf: "flex-start" }} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.rule, paddingVertical: 14 }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Label style={{ color: colors.ink }}>Show my Faves on my profile</Label>
                  <BodySm style={{ color: colors.ink3 }}>Your saved shops and collections. Off means only you see them.</BodySm>
                  {favesFailed ? <BodySm style={{ color: colors.oxblood }}>{"Couldn't save that. Try again."}</BodySm> : null}
                </View>
                <Switch
                  value={profile.favesPublic}
                  onValueChange={toggleFaves}
                  accessibilityLabel="Show my Faves on my profile"
                  trackColor={{ true: colors.oxblood, false: colors.rule }}
                  thumbColor={colors.card}
                />
              </View>
              <View style={{ gap: 4 }}>
                <Label style={{ color: colors.ink, marginBottom: 6 }}>Tell us</Label>
                {TELL_US.map((t) => (
                  <Tap
                    key={t.about}
                    feedback="tint"
                    onPress={() => router.push({ pathname: "/tell-us", params: { about: t.about, from: "/settings" } })}
                    accessibilityRole="button"
                    style={{ minHeight: 48, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.rule2 }}
                  >
                    <Body style={{ flex: 1 }}>{t.label}</Body>
                    <Body style={{ color: colors.ink3 }}>›</Body>
                  </Tap>
                ))}
                <Tap
                  feedback="tint"
                  onPress={() => router.push("/sent")}
                  accessibilityRole="button"
                  style={{ minHeight: 48, flexDirection: "row", alignItems: "center" }}
                >
                  <Body style={{ flex: 1 }}>What you've sent</Body>
                  <Body style={{ color: colors.ink3 }}>›</Body>
                </Tap>
              </View>
              <Tap
                onPress={signOut}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Label style={{ color: colors.ink2, textDecorationLine: "underline" }}>Sign out</Label>
              </Tap>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
