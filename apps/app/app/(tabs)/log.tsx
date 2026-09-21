import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { useAuth } from "@/context/auth";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { Body, ButtonOx, D2 } from "@/components/primitives";
import { LogForm } from "@/components/log/log-form";
import { parseLogParams } from "@/lib/log/params";

export default function LogScreen() {
  const { session } = useAuth();
  const raw = useLocalSearchParams();
  if (!session) return <SignInPrompt message="Sign in to log a visit." />;

  const params = parseLogParams(raw);
  if (params.kind === "none") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16, backgroundColor: colors.paper }}>
        <D2 style={{ textAlign: "center" }}>Which shop?</D2>
        <Body style={{ textAlign: "center", color: colors.ink3, maxWidth: 260 }}>Pick the shop on the map, then log your visit from there.</Body>
        <ButtonOx
          title="Find a shop on the map"
          accessibilityRole="button"
          accessibilityLabel="Find a shop on the map"
          onPress={() => router.push("/map")}
        />
      </View>
    );
  }

  // Key on the shop so a different shop never inherits the previous form state.
  const key = params.kind === "existing" ? params.shopId : params.externalId;
  return <LogForm key={key} params={params} userId={session.user.id} />;
}
