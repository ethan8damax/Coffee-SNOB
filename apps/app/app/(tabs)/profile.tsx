import { ActivityIndicator, View } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { useAuth } from "@/context/auth";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { ProfileView } from "@/components/profile/profile-view";
import { Body, ButtonLine } from "@/components/primitives";

export default function ProfileScreen() {
  const { session, profile, loading, refreshProfile } = useAuth();
  if (!loading && !session) return <SignInPrompt message="Sign in to see your profile." />;

  if (!session || !profile) {
    // Session (or its profile row) is still resolving; if it finished without a profile, offer a retry.
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16, backgroundColor: colors.paper }}>
        {loading ? (
          <ActivityIndicator color={colors.oxblood} />
        ) : (
          <>
            <Body style={{ textAlign: "center", color: colors.ink3, maxWidth: 260 }}>Couldn't load your profile.</Body>
            <ButtonLine title="Try again" onPress={refreshProfile} accessibilityRole="button" accessibilityLabel="Try loading your profile again" />
          </>
        )}
      </View>
    );
  }

  return <ProfileView username={profile.username} viewerId={session.user.id} />;
}
