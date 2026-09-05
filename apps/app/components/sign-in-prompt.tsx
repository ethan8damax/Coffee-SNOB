import { View } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { Body, ButtonLine, ButtonOx } from "./primitives";

export function SignInPrompt({ message }: { message: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16, backgroundColor: colors.paper }}>
      <Body style={{ textAlign: "center", color: colors.ink3, maxWidth: 260 }}>{message}</Body>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <ButtonLine title="Sign in" onPress={() => router.push("/sign-in")} />
        <ButtonOx title="Create account" onPress={() => router.push("/sign-up")} />
      </View>
    </View>
  );
}
