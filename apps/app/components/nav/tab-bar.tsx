import type { ComponentProps } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets, useSafeAreaFrame } from "react-native-safe-area-context";
import { colors } from "@coffeesnob/design-tokens";
import { NAV_ITEMS } from "@/lib/nav";
import { NavIcon } from "./nav-icon";

// Derived from expo-router's own prop type so we don't depend on
// @react-navigation/bottom-tabs directly.
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

// ponytail: TEMPORARY diagnostic for the real-device bottom-gap bug — remove this whole
// block (and the <Text> that renders DEBUG_INFO below) once we have the real values and
// a confirmed fix. Shows what this component actually reads vs. the window's own report.
function useDebugInfo() {
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const window = useWindowDimensions();
  return `insets b=${insets.bottom} t=${insets.top} | frame h=${Math.round(frame.height)} | window h=${Math.round(window.height)}`;
}

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 18);
  const debugInfo = useDebugInfo();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        backgroundColor: colors.oxblood,
        height: 60 + bottom,
        paddingBottom: bottom,
      }}
    >
      {/* ponytail: TEMPORARY — remove with useDebugInfo above once diagnosed. */}
      <Text style={{ position: "absolute", top: 2, left: 4, right: 4, fontSize: 8, color: colors.cream, opacity: 0.9 }} numberOfLines={1}>
        {debugInfo}
      </Text>
      {NAV_ITEMS.map((item) => {
        const route = state.routes.find((r) => r.name === item.route);
        if (!route) return null;
        const focused = state.routes[state.index]?.name === item.route;

        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        if (item.accent) {
          // The burnt "square" now wraps the icon and label together (it used to be the
          // Log-a-visit action button's own footprint; Map inherits the whole shape, not just the color).
          return (
            <Pressable key={item.route} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={item.label} style={{ flex: 1, alignItems: "center" }}>
              <View style={{ alignItems: "center", gap: 3, borderRadius: 2, backgroundColor: colors.burnt, paddingVertical: 6, paddingHorizontal: 14 }}>
                {/* ink, not paper/cream: matches ButtonBu's own burnt-background text color — 4.8:1 contrast vs 3.3:1, needed for AA at this text size. */}
                <NavIcon name={item.icon} size={18} color={colors.ink} />
                <Text style={{ fontFamily: "AreaExtended-Bold", fontSize: 7.5, letterSpacing: 0.75, textTransform: "uppercase", color: colors.ink }}>
                  {item.label}
                </Text>
              </View>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={item.route}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={item.label}
            style={{ flex: 1, alignItems: "center", gap: 4, paddingTop: 4 }}
          >
            {/* Active marker is a burnt bar, not burnt type (design note: 7.5px burnt on oxblood fails contrast). */}
            {focused && <View style={{ position: "absolute", top: -5, width: 16, height: 2, backgroundColor: colors.burnt }} />}
            <View style={{ opacity: focused ? 1 : 0.5 }}>
              <NavIcon name={item.icon} size={20} color={colors.cream} />
            </View>
            <Text
              style={{
                fontFamily: "AreaExtended-Bold",
                fontSize: 7.5,
                letterSpacing: 0.75,
                textTransform: "uppercase",
                color: colors.cream,
                opacity: focused ? 1 : 0.5,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
