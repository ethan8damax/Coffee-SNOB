# Anonymous Map Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged-out visitor reach `/map` in `apps/app` instead of being forced into sign-up, while every other tab shows a sign-in prompt instead of its (currently stub) content.

**Architecture:** Add a boolean `isPublicTabRoute` carve-out to the existing `resolveRouteGroup` root-gate function (computed from `pathname === "/map"`, same pattern already used for the `/reset-password` carve-out), so a session-less visitor on `/map` resolves to `(tabs)` instead of `(auth)`. Add one shared `<SignInPrompt />` component and render it from each of the four still-stub tab screens (Home, Log, Lists, Profile) whenever `useAuth()` reports no session. The map screen itself needs no changes — its data is already public-read and its "Log a visit" action already navigates to the newly-gated Log tab.

**Tech Stack:** Expo Router, React Native, Vitest. No backend/schema changes (see `docs/superpowers/specs/2026-09-04-anonymous-map-access-design.md` — all relevant tables are already public-read RLS).

---

### Task 1: Root gate carve-out for `/map`

**Files:**
- Modify: `apps/app/lib/auth/resolve-route-group.ts`
- Modify: `apps/app/lib/auth/resolve-route-group.test.ts`
- Modify: `apps/app/app/_layout.tsx`

This is one task, not three, because the type signature change in `resolve-route-group.ts` and its call site in `_layout.tsx` must land together — splitting them would leave `pnpm --filter app typecheck` broken between commits (the call site would be missing a newly-required field).

- [ ] **Step 1: Update the test file with the new parameter**

Replace the full contents of `apps/app/lib/auth/resolve-route-group.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveRouteGroup } from "./resolve-route-group";

describe("resolveRouteGroup", () => {
  it("sends an unauthenticated user to (auth)", () => {
    expect(
      resolveRouteGroup({ hasSession: false, isRecoveryRoute: false, isPublicTabRoute: false, onboarded: false })
    ).toBe("(auth)");
  });

  it("sends a password-recovery deep link to reset-password even with no session yet", () => {
    expect(
      resolveRouteGroup({ hasSession: false, isRecoveryRoute: true, isPublicTabRoute: false, onboarded: false })
    ).toBe("reset-password");
  });

  it("sends a password-recovery deep link to reset-password even for an onboarded, signed-in user", () => {
    expect(
      resolveRouteGroup({ hasSession: true, isRecoveryRoute: true, isPublicTabRoute: false, onboarded: true })
    ).toBe("reset-password");
  });

  it("sends a signed-in, un-onboarded user to (onboarding)", () => {
    expect(
      resolveRouteGroup({ hasSession: true, isRecoveryRoute: false, isPublicTabRoute: false, onboarded: false })
    ).toBe("(onboarding)");
  });

  it("sends a signed-in, onboarded user to (tabs)", () => {
    expect(
      resolveRouteGroup({ hasSession: true, isRecoveryRoute: false, isPublicTabRoute: false, onboarded: true })
    ).toBe("(tabs)");
  });

  it("sends an unauthenticated user on a public tab route to (tabs) instead of (auth)", () => {
    expect(
      resolveRouteGroup({ hasSession: false, isRecoveryRoute: false, isPublicTabRoute: true, onboarded: false })
    ).toBe("(tabs)");
  });

  it("still prioritizes reset-password over a public tab route", () => {
    expect(
      resolveRouteGroup({ hasSession: false, isRecoveryRoute: true, isPublicTabRoute: true, onboarded: false })
    ).toBe("reset-password");
  });

  it("has no effect once there's a session (isPublicTabRoute is only consulted when there's no session)", () => {
    expect(
      resolveRouteGroup({ hasSession: true, isRecoveryRoute: false, isPublicTabRoute: true, onboarded: true })
    ).toBe("(tabs)");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter app test -- resolve-route-group`
Expected: FAIL — a TypeScript error, since `isPublicTabRoute` isn't a known property of `resolveRouteGroup`'s parameter type yet (`Object literal may only specify known properties...`).

- [ ] **Step 3: Update `resolveRouteGroup`**

Replace the full contents of `apps/app/lib/auth/resolve-route-group.ts`:

```typescript
export type RouteGroup = "(auth)" | "reset-password" | "(onboarding)" | "(tabs)";

export function resolveRouteGroup(params: {
  hasSession: boolean;
  isRecoveryRoute: boolean;
  isPublicTabRoute: boolean;
  onboarded: boolean;
}): RouteGroup {
  if (params.isRecoveryRoute) return "reset-password";
  if (!params.hasSession) return params.isPublicTabRoute ? "(tabs)" : "(auth)";
  return params.onboarded ? "(tabs)" : "(onboarding)";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter app test -- resolve-route-group`
Expected: PASS, 8/8.

- [ ] **Step 5: Wire `pathname` into the call site**

In `apps/app/app/_layout.tsx`, find:

```typescript
  const group = resolveRouteGroup({
    hasSession: !!session,
    isRecoveryRoute: pathname === "/reset-password",
    onboarded: !!profile?.onboarded_at,
  });
```

Replace with:

```typescript
  const group = resolveRouteGroup({
    hasSession: !!session,
    isRecoveryRoute: pathname === "/reset-password",
    isPublicTabRoute: pathname === "/map",
    onboarded: !!profile?.onboarded_at,
  });
```

**Resolved (as implemented):** `pathname === "/map"` was wrong. `usePathname()`
is a global, app-wide hook, not scoped to the active navigator, so
`RootNavigator` recomputes `group` on every pathname change anywhere in the
app — including tab switches inside the nested `(tabs)` navigator. That meant
`isPublicTabRoute` went false (and the whole `(tabs)` group got evicted to
`(auth)`) the moment an anonymous visitor tapped any tab other than Map, or a
signed-in user signed out while on a gated tab. Found during final review.
Fixed by replacing this line with `isPublicTabRoute: isPublicTabPath(pathname)`,
using a new tested helper in `resolve-route-group.ts` that treats all five tab
routes (`/`, `/map`, `/log`, `/lists`, `/profile`) as public, letting the
per-screen `SignInPrompt` checks (Tasks 3-6) do the actual content gating.

- [ ] **Step 6: Verify the whole app typechecks and tests pass**

Run: `pnpm --filter app typecheck && pnpm --filter app test`
Expected: both PASS (typecheck clean, full suite green — 8/8 in `resolve-route-group.test.ts` plus whatever else already existed).

- [ ] **Step 7: Commit**

```bash
git add apps/app/lib/auth/resolve-route-group.ts apps/app/lib/auth/resolve-route-group.test.ts apps/app/app/_layout.tsx
git commit -m "feat: let a logged-out visitor reach /map instead of being forced to sign up"
```

---

### Task 2: `SignInPrompt` component

**Files:**
- Create: `apps/app/components/sign-in-prompt.tsx`

No test file for this task: it's a presentational component with zero branching logic, and this codebase has no component-rendering test infrastructure set up anywhere in `apps/app` (every existing test here — `resolve-route-group.test.ts`, `pin-style.test.ts`, `directions.test.ts`, `nearby-map-data.test.ts` — tests a pure function, never a rendered component). Adding React Testing Library or similar for one static component would be new infrastructure for no real coverage benefit; consistent with how `MapView.native.tsx`/`MapView.web.tsx` shipped untested in the map-screen plan.

- [ ] **Step 1: Implement**

```tsx
// apps/app/components/sign-in-prompt.tsx
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
```

(`ButtonLine`/`ButtonOx`/`Body` and the `colors` token set already exist and are used the same way in `apps/app/app/(auth)/sign-in.tsx` — this reuses the established button hierarchy: outlined `ButtonLine` for the lower-commitment "Sign in", solid `ButtonOx` for the higher-commitment "Create account".)

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter app typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/app/components/sign-in-prompt.tsx
git commit -m "feat: add shared sign-in prompt for gated tab content"
```

---

### Task 3: Gate the Home tab

**Files:**
- Modify: `apps/app/app/(tabs)/index.tsx`

- [ ] **Step 1: Implement**

Replace the full contents of `apps/app/app/(tabs)/index.tsx`:

```tsx
import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { SignInPrompt } from "@/components/sign-in-prompt";

export default function HomeScreen() {
  const { session } = useAuth();
  const [cityCount, setCityCount] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("cities")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setCityCount(count ?? 0));
  }, []);

  if (!session) return <SignInPrompt message="Sign in to see what's near you." />;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Home — discovery feed (not yet built)</Text>
      <Text>{cityCount === null ? "Loading cities…" : `${cityCount} cities in Supabase`}</Text>
    </View>
  );
}
```

The `useAuth()` and `useState`/`useEffect` calls stay unconditional, above the `if (!session)` check — React requires every hook to run on every render, so the conditional return must come after all hook calls, never before or between them.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter app typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "apps/app/app/(tabs)/index.tsx"
git commit -m "feat: show sign-in prompt on Home tab when logged out"
```

---

### Task 4: Gate the Log tab

**Files:**
- Modify: `apps/app/app/(tabs)/log.tsx`

- [ ] **Step 1: Implement**

Replace the full contents of `apps/app/app/(tabs)/log.tsx`:

```tsx
import { View, Text } from "react-native";
import { useAuth } from "@/context/auth";
import { SignInPrompt } from "@/components/sign-in-prompt";

export default function LogScreen() {
  const { session } = useAuth();
  if (!session) return <SignInPrompt message="Sign in to log a visit." />;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Log a visit (not yet built)</Text>
    </View>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter app typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "apps/app/app/(tabs)/log.tsx"
git commit -m "feat: show sign-in prompt on Log tab when logged out"
```

---

### Task 5: Gate the Lists tab

**Files:**
- Modify: `apps/app/app/(tabs)/lists.tsx`

- [ ] **Step 1: Implement**

Replace the full contents of `apps/app/app/(tabs)/lists.tsx`:

```tsx
import { View, Text } from "react-native";
import { useAuth } from "@/context/auth";
import { SignInPrompt } from "@/components/sign-in-prompt";

export default function ListsScreen() {
  const { session } = useAuth();
  if (!session) return <SignInPrompt message="Sign in to see your collections." />;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Collections (not yet built)</Text>
    </View>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter app typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "apps/app/app/(tabs)/lists.tsx"
git commit -m "feat: show sign-in prompt on Lists tab when logged out"
```

---

### Task 6: Gate the Profile tab

**Files:**
- Modify: `apps/app/app/(tabs)/profile.tsx`

- [ ] **Step 1: Implement**

Replace the full contents of `apps/app/app/(tabs)/profile.tsx`:

```tsx
import { View, Text, Pressable } from "react-native";
import { useAuth } from "@/context/auth";
import { SignInPrompt } from "@/components/sign-in-prompt";

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  if (!session) return <SignInPrompt message="Sign in to see your profile." />;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
      <Text>Profile (not yet built)</Text>
      <Pressable onPress={signOut}>
        <Text style={{ textDecorationLine: "underline" }}>Sign out</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter app typecheck`
Expected: PASS

- [ ] **Step 3: Run the full test suite one more time**

Run: `pnpm --filter app test && pnpm --filter app typecheck`
Expected: both PASS — this is the last task, so this is the final whole-feature check before review.

- [ ] **Step 4: Commit**

```bash
git add "apps/app/app/(tabs)/profile.tsx"
git commit -m "feat: show sign-in prompt on Profile tab when logged out"
```

---

## Self-Review Notes

- **Spec coverage:** root gate carve-out (Task 1), shared sign-in prompt (Task 2), all four stub tabs gated (Tasks 3-6). Map screen intentionally untouched, per the spec's finding that it needs no changes.
- **Not covered here (explicitly out of scope per the spec):** resuming the log-a-visit flow after sign-up, any public route besides `/map`, a standalone anonymous-only map page.
- **Natural next step after this plan ships** (not part of this plan — a separate, already-designed but not-yet-scheduled piece of work): updating the marketing site's nav to actually point a "See what's near you" CTA at `/map`, replacing the redundant "Create account" button next to "Sign in" — that was the original motivation for this work, discussed earlier in this session but deliberately not bundled in here since it's an independent change to a different app (`apps/web`).
