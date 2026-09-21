# M0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `apps/app` the design's real shell — oxblood tab bar on phones, oxblood left rail on desktop, Forevs display type, Chip/ButtonBu primitives — and strip the city/guide UI, so every later phase builds on the right foundation.

**Architecture:** Nav structure lives in one pure module (`lib/nav.ts`, unit-tested). Two thin RN components render it: `TabBar` (<1024px, passed to expo-router `Tabs` via `tabBar`) and `Rail` (≥1024px, rendered beside `Tabs`, whose own bar is hidden). Style decisions that are pure (`chip-style.ts`) follow the existing `detour-style.ts` + test pattern; RN components stay untested glue, matching the codebase's split.

**Tech Stack:** Expo 57 / expo-router 57 / react-native-web, react-native-svg, vitest. Design source: Claude Design project `019df027-97af-74d2-a376-2a823fc1ddc5` (`styles.css`, `screens/home.jsx` `TabBar`, `screens/wide.jsx` `Rail`).

**Out of scope for M0 (moved):** Mapbox removal moves to M1 so the map is never left without an implementation (it is swapped atomically for Leaflet). Desktop top bar with search is skipped — there is no search feature in v1; add it when search exists. Token values (`teal`, `ink3`) intentionally differ from the design for contrast and are left alone.

**Working directory for all commands:** the worktree root (`Coffee-SNOB/`). Test command: `pnpm --filter app test`. Typecheck: `pnpm --filter app typecheck`.

---

### Task 0: Commit docs and create the worktree

**Files:** none modified in code.

- [ ] **Step 1: Commit the planning docs on `main`** (so the worktree contains them)

```bash
git add CLAUDE.md docs/v1-launch-tracker.md docs/superpowers/specs/2026-09-21-v1-map-and-profile-phases-design.md docs/superpowers/plans/2026-09-21-m0-foundation.md
git commit -m "docs: v1 launch phases, tracker, and M0 plan

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Create an isolated worktree** using `superpowers:using-git-worktrees`, branch `worktree-v1-m0-foundation`. Install deps there if the skill's flow doesn't (`pnpm install`) and copy the two `.env.local` files from the main checkout (they are gitignored): `apps/web/.env.local`, `apps/app/.env.local`.

- [ ] **Step 3: Baseline** — `pnpm --filter app test && pnpm --filter app typecheck`. Expected: all pass (31 app tests).

---

### Task 1: Nav model (pure, tested)

**Files:**
- Create: `apps/app/lib/nav.ts`
- Test: `apps/app/lib/nav.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/app/lib/nav.test.ts
import { describe, it, expect } from "vitest";
import { NAV_ITEMS, DESKTOP_MIN_WIDTH, isDesktopWidth, isNavRoute, routeForPath } from "./nav";

describe("nav", () => {
  it("lists the v1 destinations in design order, with Log as the action", () => {
    expect(NAV_ITEMS.map((i) => i.route)).toEqual(["index", "map", "log", "profile"]);
    expect(NAV_ITEMS.filter((i) => i.isAction).map((i) => i.route)).toEqual(["log"]);
  });

  it("switches to the desktop shell at exactly 1024px", () => {
    expect(DESKTOP_MIN_WIDTH).toBe(1024);
    expect(isDesktopWidth(1023)).toBe(false);
    expect(isDesktopWidth(1024)).toBe(true);
  });

  it("recognises nav routes and hides the retired lists tab", () => {
    expect(isNavRoute("map")).toBe(true);
    expect(isNavRoute("lists")).toBe(false);
  });

  it("maps pathnames to routes", () => {
    expect(routeForPath("/")).toBe("index");
    expect(routeForPath("/map")).toBe("map");
    expect(routeForPath("/profile")).toBe("profile");
    expect(routeForPath("/somewhere-else")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter app test -- lib/nav.test.ts`
Expected: FAIL — cannot resolve `./nav`.

- [ ] **Step 3: Implement**

```ts
// apps/app/lib/nav.ts
export const DESKTOP_MIN_WIDTH = 1024;

export type NavRoute = "index" | "map" | "log" | "profile";

export type NavItem = {
  route: NavRoute;
  path: string;
  label: string;
  icon: "home" | "map" | "plus" | "user";
  // The Log destination is the burnt "+" action, not a regular tab.
  isAction: boolean;
};

// Order and labels follow the design's TabBar (screens/home.jsx). The design's
// "Lists" tab is omitted for v1 — collections ship after launch.
export const NAV_ITEMS: NavItem[] = [
  { route: "index", path: "/", label: "Feed", icon: "home", isAction: false },
  { route: "map", path: "/map", label: "Map", icon: "map", isAction: false },
  { route: "log", path: "/log", label: "Log a visit", icon: "plus", isAction: true },
  { route: "profile", path: "/profile", label: "You", icon: "user", isAction: false },
];

export function isDesktopWidth(width: number): boolean {
  return width >= DESKTOP_MIN_WIDTH;
}

export function isNavRoute(name: string): name is NavRoute {
  return NAV_ITEMS.some((i) => i.route === name);
}

export function routeForPath(pathname: string): NavRoute | null {
  return NAV_ITEMS.find((i) => i.path === pathname)?.route ?? null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter app test -- lib/nav.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/app/lib/nav.ts apps/app/lib/nav.test.ts
git commit -m "feat: add v1 nav model with desktop breakpoint

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Nav icons

**Files:**
- Create: `apps/app/components/nav/nav-icon.tsx`

- [ ] **Step 1: Create the icon component** (paths copied from the design's `Icon` set in `screens/_primitives.jsx`)

```tsx
// apps/app/components/nav/nav-icon.tsx
import Svg, { Circle, Path } from "react-native-svg";
import type { NavItem } from "@/lib/nav";

export function NavIcon({ name, size = 20, color }: { name: NavItem["icon"]; size?: number; color: string }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeLinecap: "square" as const };
  switch (name) {
    case "home":
      return (
        <Svg {...common} strokeWidth={1.8}>
          <Path d="M3.5 10.5 12 3.5l8.5 7" />
          <Path d="M5.5 10v10h13V10" />
        </Svg>
      );
    case "map":
      return (
        <Svg {...common} strokeWidth={1.8}>
          <Path d="M9 3.5 3.5 5.5v15L9 18.5l6 2 5.5-2v-15l-5.5 2-6-2z" />
          <Path d="M9 3.5v15M15 5.5v15" />
        </Svg>
      );
    case "plus":
      return (
        <Svg {...common} strokeWidth={2.1}>
          <Path d="M12 4.5v15M4.5 12h15" />
        </Svg>
      );
    case "user":
      return (
        <Svg {...common} strokeWidth={1.8}>
          <Circle cx={12} cy={8} r={4} />
          <Path d="M4.5 20.5c1.5-3.6 4.2-5.5 7.5-5.5s6 1.9 7.5 5.5" />
        </Svg>
      );
  }
}
```

- [ ] **Step 2: Typecheck** — `pnpm --filter app typecheck`. Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/app/components/nav/nav-icon.tsx
git commit -m "feat: add nav icons from the design system

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Oxblood bottom TabBar (phones)

Design spec (`styles.css` `.tabbar`): height 78 incl. 18 bottom padding, oxblood ground, cream icons/labels at 50% opacity (100% active), 7.5px Area Extended Bold uppercase labels at 0.1em tracking, 16×2 burnt bar above the active tab, and the Log action as a 46×46 burnt square with a paper "+".

**Files:**
- Create: `apps/app/components/nav/tab-bar.tsx`

- [ ] **Step 1: Implement**

```tsx
// apps/app/components/nav/tab-bar.tsx
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
```

- [ ] **Step 2: Typecheck** — `pnpm --filter app typecheck`. Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/app/components/nav/tab-bar.tsx
git commit -m "feat: add oxblood bottom tab bar matching the design

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: ButtonBu primitive (needed by the rail)

**Files:**
- Modify: `apps/app/components/primitives.tsx`

- [ ] **Step 1: Add the import and component.** Change the first import line to include `ReactNode`:

```tsx
import type { ReactNode } from "react";
import { Text, View, Pressable, StyleSheet, type TextProps, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
```

Add after `ButtonLine`:

```tsx
export function ButtonBu({
  title,
  icon,
  style,
  ...rest
}: { title: string; icon?: ReactNode; style?: StyleProp<ViewStyle> } & Omit<PressableProps, "style">) {
  return (
    <Pressable {...rest} style={[styles.btn, styles.btnBu, style]}>
      {icon}
      <Text style={styles.btnBuText}>{title}</Text>
    </Pressable>
  );
}
```

Add to `StyleSheet.create` after `btnLineText`:

```tsx
  btnBu: { backgroundColor: colors.burnt, flexDirection: "row", gap: 7 },
  btnBuText: {
    fontFamily: "AreaExtended-Black",
    fontSize: 10.5,
    letterSpacing: 1.05,
    textTransform: "uppercase",
    color: colors.ink,
  },
```

- [ ] **Step 2: Typecheck** — `pnpm --filter app typecheck`. Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/app/components/primitives.tsx
git commit -m "feat: add burnt ButtonBu primitive

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Desktop Rail

Design spec (`screens/wide.jsx` `Rail`): 212px oxblood column, wordmark in cream with "Specialty coffee locator" under it, nav rows (icon 19 + 10px Area Extended Black label, active = full opacity + 2px burnt left border + darkened row, inactive = 62% opacity), a full-width burnt "Log a visit" button, and the user at the bottom.

**Files:**
- Create: `apps/app/components/nav/rail.tsx`

- [ ] **Step 1: Implement**

```tsx
// apps/app/components/nav/rail.tsx
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
```

- [ ] **Step 2: Typecheck** — `pnpm --filter app typecheck`. Expected: PASS. (If `profile.display_name`/`username` errors, check `getProfile`'s return type in `packages/supabase/src/queries.ts:56` — both columns exist on `profiles`.)

- [ ] **Step 3: Commit**

```bash
git add apps/app/components/nav/rail.tsx
git commit -m "feat: add desktop navigation rail

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Responsive tabs layout

**Files:**
- Modify: `apps/app/app/(tabs)/_layout.tsx` (replace whole file)

- [ ] **Step 1: Replace the file**

```tsx
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
        </Tabs>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck + tests** — `pnpm --filter app typecheck && pnpm --filter app test`. Expected: PASS.

- [ ] **Step 3: Visual check** (Chrome extension). Start the web app in the background: `pnpm --filter app web`. Open the printed local URL, then resize the window to 393×852 and confirm: oxblood bottom bar with Feed / Map / burnt "+" / You, burnt bar above the active tab. Resize to 1440×900 and confirm: 212px oxblood rail with wordmark, Feed / Map / You, burnt "Log a visit" button, user block at the bottom, no bottom bar. Fix any visible differences from the design before continuing.

- [ ] **Step 4: Commit**

```bash
git add "apps/app/app/(tabs)/_layout.tsx"
git commit -m "feat: responsive shell — tab bar on phones, rail on desktop

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Chip primitive (pure style + component)

**Files:**
- Create: `apps/app/components/chip-style.ts`
- Test: `apps/app/components/chip-style.test.ts`
- Create: `apps/app/components/chip.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// apps/app/components/chip-style.test.ts
import { describe, it, expect } from "vitest";
import { colors } from "@coffeesnob/design-tokens";
import { chipStyleForVariant } from "./chip-style";

describe("chipStyleForVariant", () => {
  it("default is an outlined chip with ink-2 text", () => {
    expect(chipStyleForVariant("default")).toEqual({ background: "transparent", text: colors.ink2, border: colors.rule });
  });
  it("on is ink-filled with paper text", () => {
    expect(chipStyleForVariant("on")).toEqual({ background: colors.ink, text: colors.paper, border: colors.ink });
  });
  it("ox is oxblood-filled with cream text", () => {
    expect(chipStyleForVariant("ox")).toEqual({ background: colors.oxblood, text: colors.cream, border: colors.oxblood });
  });
  it("bu is burnt-filled with ink text", () => {
    expect(chipStyleForVariant("bu")).toEqual({ background: colors.burnt, text: colors.ink, border: colors.burnt });
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter app test -- components/chip-style.test.ts`. Expected: FAIL, cannot resolve `./chip-style`.

- [ ] **Step 3: Implement**

```ts
// apps/app/components/chip-style.ts
import { colors } from "@coffeesnob/design-tokens";

export type ChipVariant = "default" | "on" | "ox" | "bu";
export type ChipStyle = { background: string; text: string; border: string };

// Mirrors `.chip`, `.chip.on`, `.chip.ox`, `.chip.bu` in the design's styles.css.
export function chipStyleForVariant(variant: ChipVariant): ChipStyle {
  switch (variant) {
    case "on":
      return { background: colors.ink, text: colors.paper, border: colors.ink };
    case "ox":
      return { background: colors.oxblood, text: colors.cream, border: colors.oxblood };
    case "bu":
      return { background: colors.burnt, text: colors.ink, border: colors.burnt };
    default:
      return { background: "transparent", text: colors.ink2, border: colors.rule };
  }
}
```

```tsx
// apps/app/components/chip.tsx
import type { ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { chipStyleForVariant, type ChipVariant } from "./chip-style";

export function Chip({
  label,
  variant = "default",
  icon,
  onPress,
}: {
  label: string;
  variant?: ChipVariant;
  icon?: ReactNode;
  onPress?: () => void;
}) {
  const s = chipStyleForVariant(variant);
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        height: 27,
        paddingHorizontal: 11,
        borderRadius: 2,
        borderWidth: 1,
        borderColor: s.border,
        backgroundColor: s.background,
      }}
    >
      {icon}
      <Text style={{ fontFamily: "AreaExtended-Bold", fontSize: 8.5, letterSpacing: 0.85, textTransform: "uppercase", color: s.text }}>{label}</Text>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {body}
    </Pressable>
  ) : (
    body
  );
}
```

- [ ] **Step 4: Run tests + typecheck** — `pnpm --filter app test -- components/chip-style.test.ts && pnpm --filter app typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/app/components/chip-style.ts apps/app/components/chip-style.test.ts apps/app/components/chip.tsx
git commit -m "feat: add Chip primitive matching the design

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Forevs display typeface (needs font file from the user)

The design sets `.d1`/`.d2` in **Forevs Bold** (`--f-display`); the app currently uses Area Bold for both. Forevs is not in this repo.

**Files:**
- Create: `apps/app/assets/fonts/forevs/Forevs-Bold.otf` (**supplied by the user** — it lives in the design project at `public/fonts/forevs/Forevs-Bold.otf`)
- Modify: `apps/app/app/_layout.tsx`, `apps/app/components/primitives.tsx`

- [ ] **Step 1: Get the font.** Ask the user for `Forevs-Bold.otf` (path on their machine or drop it in the repo). Place it at `apps/app/assets/fonts/forevs/Forevs-Bold.otf`. Verify: `file apps/app/assets/fonts/forevs/Forevs-Bold.otf` → mentions "OpenType". **If the file isn't available yet, skip Tasks 8 and continue; leave the tracker item unchecked.**

- [ ] **Step 2: Register the font** in `apps/app/app/_layout.tsx` — add one line to the `useFonts` map:

```tsx
    "Forevs-Bold": require("../assets/fonts/forevs/Forevs-Bold.otf"),
```

- [ ] **Step 3: Switch D1/D2 and add D3** in `apps/app/components/primitives.tsx`. Replace the `d1` and `d2` style entries and add `d3` (design: d1 40px lh .96 ls -.015em; d2 30px lh .98 ls -.013em; d3 22px Area Bold lh 1 ls -.028em):

```tsx
  d1: { fontFamily: "Forevs-Bold", fontSize: 40, lineHeight: 38.4, letterSpacing: -0.6, color: colors.ink },
  d2: { fontFamily: "Forevs-Bold", fontSize: 30, lineHeight: 29.4, letterSpacing: -0.39, color: colors.ink },
  d3: { fontFamily: "Area-Bold", fontSize: 22, lineHeight: 22, letterSpacing: -0.62, color: colors.ink },
```

and the component next to `D2`:

```tsx
export function D3(props: TextProps) {
  return <Text {...props} style={[styles.d3, props.style]} />;
}
```

- [ ] **Step 3: Typecheck + tests** — `pnpm --filter app typecheck && pnpm --filter app test`. Expected: PASS.

- [ ] **Step 4: Visual check** — reload the web app; headlines (e.g. sign-in title, feed card shop names) should render in the flared Forevs serif, not Area.

- [ ] **Step 5: Commit**

```bash
git add apps/app/assets/fonts/forevs apps/app/app/_layout.tsx apps/app/components/primitives.tsx
git commit -m "feat: load Forevs display typeface for D1/D2, add D3

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Remove city guides from the app's feed

The app no longer shows guides. Collections stay in the Following feed (collection UI ships after launch, the data path is harmless). `getLiveCityGuides` in `packages/supabase` is still used by the marketing site — leave it.

**Files:**
- Delete: `apps/app/components/feed/guide-card.tsx`, `apps/app/lib/feed/use-guides-feed.ts`
- Modify: `apps/app/lib/feed/types.ts`, `apps/app/lib/feed/use-following-feed.ts`, `apps/app/lib/feed/merge-feed-items.test.ts`, `apps/app/app/(tabs)/index.tsx`

- [ ] **Step 1: Update the test first** — replace `apps/app/lib/feed/merge-feed-items.test.ts` (swap the guide fixture for a collection; behavior under test is unchanged):

```ts
import { describe, it, expect } from "vitest";
import { mergeFeedItems } from "./merge-feed-items";
import type { FeedItem } from "./types";

function log(id: string, createdAt: string): FeedItem {
  return {
    type: "log", id, createdAt, userId: "u1", authorName: "Mara K.", shopName: "Noi Coffee",
    shopNeighborhood: null, rating: 4, note: null, likeCount: 0, likedByMe: false, commentCount: 0,
  };
}
function collection(id: string, createdAt: string): FeedItem {
  return { type: "collection", id, createdAt, title: "Tiny bars", description: null, curatorName: "Ines L.", shopCount: 9 };
}

describe("mergeFeedItems", () => {
  it("interleaves multiple sources sorted by createdAt descending", () => {
    const result = mergeFeedItems([[log("l1", "2026-09-01T00:00:00Z")], [collection("c1", "2026-09-03T00:00:00Z"), collection("c2", "2026-08-01T00:00:00Z")]]);
    expect(result.map((r) => r.id)).toEqual(["c1", "l1", "c2"]);
  });

  it("returns an empty array when every source is empty", () => {
    expect(mergeFeedItems([[], []])).toEqual([]);
  });
});
```

- [ ] **Step 2: Remove the guide type** — replace `apps/app/lib/feed/types.ts`:

```ts
export type LogFeedCard = {
  type: "log";
  id: string;
  createdAt: string;
  userId: string;
  authorName: string;
  shopName: string;
  shopNeighborhood: string | null;
  rating: number;
  note: string | null;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
};

export type CollectionFeedCard = {
  type: "collection";
  id: string;
  createdAt: string;
  title: string;
  description: string | null;
  curatorName: string;
  shopCount: number;
};

export type FeedItem = LogFeedCard | CollectionFeedCard;
```

- [ ] **Step 3: Drop guides and city lookups from the following feed** — replace `apps/app/lib/feed/use-following-feed.ts`:

```ts
import { useEffect, useState } from "react";
import {
  getFollowedUserIds,
  getFollowingFeedLogs,
  getFollowingFeedLists,
  getProfilesByIds,
  getLogLikes,
  getCommentCountsByLog,
} from "@coffeesnob/supabase";
import { mergeFeedItems } from "./merge-feed-items";
import type { FeedItem, LogFeedCard, CollectionFeedCard } from "./types";

// ponytail: framework glue (fetch-on-mount/param-change), same category as
// useNearbyMapData/useUserLocation — not unit tested, per this codebase's
// established split between tested pure logic and untested RN/effect glue.
// `supabase` is required lazily so importing this module doesn't pull in
// react-native (mirrors lib/map/nearby-map-data.ts).
export function useFollowingFeed(userId: string | null) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    async function load() {
      const { supabase } = require("../supabase");
      const followeeIds = await getFollowedUserIds(supabase, userId as string);
      const [logs, allLists] = await Promise.all([
        getFollowingFeedLogs(supabase, followeeIds),
        getFollowingFeedLists(supabase, followeeIds),
      ]);
      // v1 has no city guides; only collections reach the feed.
      const lists = allLists.filter((l) => l.type === "collection");

      const logIds = logs.map((l) => l.id);
      const curatorIds = lists.map((l) => l.curator_id).filter((id): id is string => id !== null);
      const actorIds = [...new Set([...logs.map((l) => l.user_id), ...curatorIds])];

      const [profiles, likes, commentRows] = await Promise.all([
        getProfilesByIds(supabase, actorIds),
        getLogLikes(supabase, logIds),
        getCommentCountsByLog(supabase, logIds),
      ]);
      const nameById = new Map(profiles.map((p) => [p.id, p.display_name || p.username]));

      const logCards: LogFeedCard[] = logs.map((l) => ({
        type: "log",
        id: l.id,
        createdAt: l.created_at,
        userId: l.user_id,
        authorName: nameById.get(l.user_id) ?? "Someone",
        shopName: (l.shops as { name: string } | null)?.name ?? "A shop",
        shopNeighborhood: (l.shops as { neighborhood: string | null } | null)?.neighborhood ?? null,
        rating: l.rating,
        note: l.note,
        likeCount: likes.filter((like) => like.log_id === l.id).length,
        likedByMe: likes.some((like) => like.log_id === l.id && like.user_id === userId),
        commentCount: commentRows.filter((c) => c.log_id === l.id).length,
      }));

      const listCards: CollectionFeedCard[] = lists.map((l) => ({
        type: "collection",
        id: l.id,
        createdAt: l.created_at,
        title: l.title,
        description: l.description,
        curatorName: l.curator_id ? (nameById.get(l.curator_id) ?? "The desk") : "The desk",
        shopCount: (l.list_items as unknown as { count: number }[])[0]?.count ?? 0,
      }));

      if (!cancelled) {
        setItems(mergeFeedItems([logCards, listCards]));
        setLoading(false);
      }
    }

    load().catch(() => {
      if (!cancelled) {
        setItems([]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { items, loading };
}
```

- [ ] **Step 4: Remove the Guides tab from Home** — in `apps/app/app/(tabs)/index.tsx` make these edits:

1. Delete the imports `import { GuideCard } from "@/components/feed/guide-card";` and `import { useGuidesFeed } from "@/lib/feed/use-guides-feed";`.
2. Replace `const TABS = ["Following", "Nearby", "Guides"] as const;` with `const TABS = ["Following", "Nearby"] as const;`.
3. In `EMPTY_MESSAGE`, delete the `Guides: "No live guides yet.",` line.
4. In `renderItem`, delete the line `if (item.type === "guide") return <GuideCard item={item} />;`.
5. Delete `const guides = useGuidesFeed();`.
6. Replace `const active = tab === "Following" ? following : tab === "Nearby" ? nearby : guides;` with `const active = tab === "Following" ? following : nearby;`.

- [ ] **Step 5: Delete the dead files**

```bash
git rm apps/app/components/feed/guide-card.tsx apps/app/lib/feed/use-guides-feed.ts
```

- [ ] **Step 6: Verify** — `pnpm --filter app typecheck && pnpm --filter app test`. Expected: PASS (no remaining references to `GuideFeedCard`/`GuideCard`/`useGuidesFeed`; confirm with `grep -rn "GuideFeedCard\|GuideCard\|useGuidesFeed" apps/app --include='*.ts' --include='*.tsx' --exclude-dir=node_modules` → no output).

- [ ] **Step 7: Commit**

```bash
git add -A apps/app
git commit -m "refactor: remove city guides from the app feed for v1

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Final verification and tracker

- [ ] **Step 1: Full checks** — `pnpm -r --no-bail typecheck && pnpm -r --no-bail test`. Expected: all green.

- [ ] **Step 2: Web build** — `pnpm --filter app build`. Expected: exits 0 (`expo export -p web`).

- [ ] **Step 3: Update `docs/v1-launch-tracker.md`**: check off the M0 items that are done; replace the M0 item "Remove Mapbox packages…" with a note that it moved to M1; add a Status log line, e.g. `- 2026-09-21 — M0 done: oxblood tab bar + desktop rail, Chip/ButtonBu, guides removed from feed (Forevs pending font file).` Move the "Now:" pointer to M1. Also add to M1's list: `- [ ] Remove Mapbox packages, token env var, app.json plugin, doc mentions`.

- [ ] **Step 4: Commit**

```bash
git add docs/v1-launch-tracker.md
git commit -m "docs: update tracker after M0

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage (M0 list):** Mapbox removal → moved to M1 (stated up front). City/guide UI removal → Task 9. Primitives audit vs design → Tasks 4, 7, 8 (buttons, chips, display type; TabBar → Task 3; labels/body already match `styles.css`; teal/ink3 token divergence intentionally left). Responsive shell → Tasks 1, 3, 5, 6. v1 nav (Home·Map·Log·You) → Tasks 1, 6.
- **Type consistency:** `NAV_ITEMS`, `NavItem["icon"]`, `isNavRoute`, `routeForPath`, `RAIL_WIDTH`, `ButtonBu({title, icon, style})`, `ScriptLogo` (exists in primitives), `chipStyleForVariant` are defined before use and named identically throughout.
- **Known dependency:** Task 8 needs the Forevs font from the user; it is skippable without blocking M1.
