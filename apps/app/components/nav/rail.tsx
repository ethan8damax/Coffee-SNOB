import { View, Text, Pressable } from "react-native";
import { router, usePathname } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { useAuth } from "@/context/auth";
import { NAV_ITEMS, routeForPath } from "@/lib/nav";
import { Avatar, ButtonBu, Label, ScriptLogo } from "../primitives";
import { NavIcon } from "./nav-icon";

export const RAIL_WIDTH = 212;

export function Rail() {
  const pathname = usePathname();
  const { session, profile } = useAuth();
  const active = routeForPath(pathname);
  const name = profile?.display_name || profile?.username || null;
  const action = NAV_ITEMS.find((i) => i.isAction);

  return (
    <View style={{ width: RAIL_WIDTH, backgroundColor: colors.oxblood, paddingTop: 22, paddingBottom: 20 }}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        <ScriptLogo height={28} color={colors.cream} />
        <Label style={{ color: "rgba(233,228,208,.55)", marginTop: 10 }}>Specialty coffee locator</Label>
      </View>

      <View>
        {NAV_ITEMS.filter((i) => !i.isAction).map((item) => {
          const on = active === item.route;
          return (
            <Pressable
              key={item.route}
              onPress={() => router.navigate(item.path)}
              accessibilityRole="link"
              accessibilityState={{ selected: on }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 11,
                paddingHorizontal: 20,
                borderLeftWidth: 2,
                borderLeftColor: on ? colors.burnt : "transparent",
                backgroundColor: on ? "rgba(22,19,16,.18)" : "transparent",
                opacity: on ? 1 : 0.62,
              }}
            >
              <NavIcon name={item.icon} size={19} color={colors.cream} />
              <Text style={{ fontFamily: "AreaExtended-Black", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.cream }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {action && (
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <ButtonBu
            title={action.label}
            icon={<NavIcon name="plus" size={15} color={colors.ink} />}
            onPress={() => router.navigate(action.path)}
            style={{ width: "100%", height: 42 }}
          />
        </View>
      )}

      <View style={{ marginTop: "auto", paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 10 }}>
        {session && name ? (
          <>
            <Avatar name={name} size={30} bg={colors.burnt} fg={colors.ink} />
            <View style={{ flexShrink: 1 }}>
              <Label style={{ color: colors.cream }} numberOfLines={1}>{name}</Label>
              {profile?.username ? <Label style={{ color: "rgba(233,228,208,.5)", marginTop: 4 }} numberOfLines={1}>@{profile.username}</Label> : null}
            </View>
          </>
        ) : (
          <Pressable onPress={() => router.push("/sign-in")} accessibilityRole="link">
            <Label style={{ color: colors.cream }}>Sign in</Label>
          </Pressable>
        )}
      </View>
    </View>
  );
}
