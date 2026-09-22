import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { getPublicProfileByUsername, type PublicProfile } from "@coffeesnob/supabase";
import { Body, ButtonLine, IconBack, Label } from "@/components/primitives";
import { useAuth } from "@/context/auth";
import { EditProfileForm } from "@/components/profile/edit-profile-form";

// Own-account management: edit profile + sign out. Reached from a "Settings"
// link on your own profile header (find-people lives at the Followers/
// Following stats instead — no separate entry point needed for it here).
export default function SettingsScreen() {
  const { profile: authProfile, signOut } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
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
          <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 44, height: 44, marginLeft: -12, alignItems: "center", justifyContent: "center" }}>
            <IconBack />
          </Pressable>
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
              <Pressable
                onPress={signOut}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Label style={{ color: colors.ink2, textDecorationLine: "underline" }}>Sign out</Label>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
