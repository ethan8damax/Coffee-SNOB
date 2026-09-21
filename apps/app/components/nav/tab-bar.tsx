import type { ComponentProps } from "react";
import { View, Text, Pressable } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@coffeesnob/design-tokens";
import { NAV_ITEMS } from "@/lib/nav";
import { NavIcon } from "./nav-icon";

// Derived from expo-router's own prop type so we don't depend on
// @react-navigation/bottom-tabs directly.
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 18);

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
      {NAV_ITEMS.map((item) => {
        const route = state.routes.find((r) => r.name === item.route);
        if (!route) return null;
        const focused = state.routes[state.index]?.name === item.route;

        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        if (item.isAction) {
          return (
            <Pressable key={item.route} onPress={onPress} accessibilityRole="button" accessibilityLabel={item.label} style={{ paddingHorizontal: 4 }}>
              <View style={{ width: 46, height: 46, borderRadius: 2, backgroundColor: colors.burnt, alignItems: "center", justifyContent: "center" }}>
                <NavIcon name={item.icon} size={20} color={colors.paper} />
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
