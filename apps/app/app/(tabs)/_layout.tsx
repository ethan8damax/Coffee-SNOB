import { View, useWindowDimensions } from "react-native";
import { Tabs } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { isDesktopWidth } from "@/lib/nav";
import { TabBar } from "@/components/nav/tab-bar";
import { Rail } from "@/components/nav/rail";

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const desktop = isDesktopWidth(width);

  // Same element positions in both shells so crossing the breakpoint doesn't
  // remount the navigator (and lose scroll/selection state).
  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.paper }}>
      {desktop && <Rail />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Tabs tabBar={desktop ? () => null : (props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
          <Tabs.Screen name="index" options={{ title: "Feed" }} />
          <Tabs.Screen name="map" options={{ title: "Map" }} />
          <Tabs.Screen name="log" options={{ title: "Log" }} />
          {/* Collections ship after launch; keep the route, hide it from navigation. */}
          <Tabs.Screen name="lists" options={{ href: null }} />
          <Tabs.Screen name="profile" options={{ title: "You" }} />
          {/* Detail pages keep the tab bar / rail but are not tabs themselves. */}
          <Tabs.Screen name="shop/[id]" options={{ href: null }} />
          <Tabs.Screen name="u/[username]" options={{ href: null }} />
        </Tabs>
      </View>
    </View>
  );
}
