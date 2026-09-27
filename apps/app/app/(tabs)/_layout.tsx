import { View, useWindowDimensions } from "react-native";
import { Tabs } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
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
    // ponytail: nested SafeAreaProvider is a cheap, safe hedge — expo-router's own root
    // already provides one, but TabBar's useSafeAreaInsets() reading a stale/zero value
    // on some real devices (reported: a cream gap below the tab bar on every screen,
    // not reproducible from source alone) is consistent with an insets-propagation
    // timing issue. This guarantees a fresh, correctly-scoped provider right above the
    // one component that reads insets for layout math. Revisit if this doesn't fix it —
    // next step would be logging the actual insets value on the affected device.
    <SafeAreaProvider>
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.paper }}>
        {desktop && <Rail />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tabs tabBar={desktop ? () => null : (props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
            <Tabs.Screen name="index" options={{ title: "Feed" }} />
            <Tabs.Screen name="map" options={{ title: "Map" }} />
            {/* Log a visit isn't a nav item anymore — reached from the map, a shop page, or a preview card. */}
            <Tabs.Screen name="log" options={{ href: null }} />
            {/* Collections ship after launch; keep the route, hide it from navigation. */}
            <Tabs.Screen name="lists" options={{ href: null }} />
            <Tabs.Screen name="profile" options={{ title: "You" }} />
            {/* Detail pages keep the tab bar / rail but are not tabs themselves. */}
            <Tabs.Screen name="shop/[id]" options={{ href: null }} />
            <Tabs.Screen name="u/[username]" options={{ href: null }} />
            <Tabs.Screen name="people" options={{ href: null }} />
          </Tabs>
        </View>
      </View>
    </SafeAreaProvider>
  );
}
