import { View } from "react-native";
import { router } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/build/react-navigation/bottom-tabs";
import { colors } from "@coffeesnob/design-tokens";
import { Body, ButtonLine, ButtonOx } from "./primitives";

export function SignInPrompt({ message }: { message: string }) {
  // The custom tab bar (components/nav/tab-bar.tsx) isn't auto-excluded from scene
  // content — a fully custom `tabBar` render prop means React Navigation doesn't know
  // its height and can't inset content for you (see expo-router's own doc comment on
  // BottomTabNavigationOptions.tabBarBackground: "You'd also need to use
  // useBottomTabBarHeight() to add a bottom padding to your content"). Without this,
  // flex:1 + justifyContent:"center" here centers across the *full* screen height,
  // including the space the tab bar physically covers, so the content visibly sits
  // below true-center. map.tsx works around the same gap with its own hardcoded
  // TAB_BAR_HEIGHT guess; this uses the real, always-correct value instead.
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, paddingBottom: 24 + tabBarHeight, gap: 16, backgroundColor: colors.paper }}>
      <Body style={{ textAlign: "center", color: colors.ink3, maxWidth: 260 }}>{message}</Body>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <ButtonLine title="Sign in" onPress={() => router.push("/sign-in")} />
        <ButtonOx title="Create account" onPress={() => router.push("/sign-up")} />
      </View>
    </View>
  );
}
