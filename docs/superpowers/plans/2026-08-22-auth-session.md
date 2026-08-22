# Auth & Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Supabase email/password Auth into `apps/app`, with session persistence, a trimmed 2-step onboarding (identity, taste), and route-based auth gating — so every later screen builds against a real signed-in user from day one.

**Architecture:** A Supabase-backed `AuthProvider` (React Context) tracks `session`, `profile`, and `loading`; the Expo Router root layout uses `Stack.Protected` guards (the current SDK 53+ pattern) to show exactly one of three route groups — `(auth)`, `(onboarding)`, `(tabs)` — plus a fourth top-level `reset-password` route that overrides the others whenever the app is opened via a password-recovery deep link. Sessions persist via Supabase's own documented `LargeSecureStore` (SecureStore-held AES key + AsyncStorage ciphertext), since Expo's SecureStore alone can't hold a full session payload. `packages/supabase` gains an `options` parameter so the same client factory serves both `apps/web` (default storage) and `apps/app` (native storage).

**Tech Stack:** Expo SDK 57 + Expo Router (`Stack.Protected`), Supabase Auth (`@supabase/supabase-js` v2, PKCE flow), `expo-secure-store`, `@react-native-async-storage/async-storage`, `aes-js`, `expo-font`, `react-native-svg`, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-22-auth-session-design.md`

---

## Before Task 1: create the branch

Per project convention, this whole sub-project is developed on its own branch and merged to `main` only once verified end-to-end (Task 21).

- [ ] **Step 1: Create and switch to the feature branch**

```bash
git checkout -b feat/auth-session
```

Expected: `Switched to a new branch 'feat/auth-session'`

---

## Phase A — Schema & shared query layer

### Task 1: Migration — `profiles.display_name` and `profiles.onboarded_at`

**Files:**
- Create: `supabase/migrations/0005_profile_onboarding.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0005_profile_onboarding.sql`:

```sql
alter table public.profiles
  add column display_name text,
  add column onboarded_at timestamptz;
```

- [ ] **Step 2: Apply it via the Supabase MCP server**

Call `mcp__plugin_supabase_supabase__apply_migration` with `project_id: kyiuhuivyugoqljqodil`, `name: "profile_onboarding"`, `query: <the SQL from Step 1>`.
Expected: success response, no error.

- [ ] **Step 3: Verify the columns exist**

Call `mcp__plugin_supabase_supabase__list_tables` with `project_id: kyiuhuivyugoqljqodil`, `schemas: ["public"]`, `verbose: true`.
Expected: `profiles` now lists `display_name` (text, nullable) and `onboarded_at` (timestamptz, nullable).

- [ ] **Step 4: Regenerate Supabase TypeScript types**

Call `mcp__plugin_supabase_supabase__generate_typescript_types` with `project_id: kyiuhuivyugoqljqodil`. Write the returned TypeScript directly to `packages/supabase/src/types.ts`, overwriting its current contents unmodified.
Expected: the `profiles` row type in the file now includes `display_name: string | null` and `onboarded_at: string | null`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_profile_onboarding.sql packages/supabase/src/types.ts
git commit -m "Add profiles.display_name and profiles.onboarded_at"
```

- [ ] **Step 6: Confirm "Confirm email" is enabled (dashboard-only setting)**

This isn't reachable via migration or the Supabase MCP tools — it's a project-level Auth setting. In the Supabase Dashboard for project `kyiuhuivyugoqljqodil`, go to Authentication → Sign In / Providers → Email, and confirm "Confirm email" is turned on (it's Supabase's default for new projects, but verify rather than assume, since this project may have been touched during earlier setup). This gates whether `supabase.auth.signUp()` returns a session immediately or requires the email-confirmation flow that Tasks 14–15 build for. No code change — note the confirmed state before continuing.

---

### Task 2: `packages/supabase` — accept auth client options

**Files:**
- Modify: `packages/supabase/src/client.ts`
- Create: `packages/supabase/test/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/supabase/test/client.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

const createClientMock = vi.fn(() => ({ mocked: true }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const { createSupabaseClient } = await import("../src/client");

describe("createSupabaseClient", () => {
  it("throws when url is missing", () => {
    expect(() => createSupabaseClient("", "anon-key")).toThrow(
      "createSupabaseClient: both url and anonKey are required"
    );
  });

  it("throws when anonKey is missing", () => {
    expect(() => createSupabaseClient("https://x.supabase.co", "")).toThrow(
      "createSupabaseClient: both url and anonKey are required"
    );
  });

  it("passes url, anonKey, and options straight through to createClient", () => {
    const options = { auth: { persistSession: false } };
    createSupabaseClient("https://x.supabase.co", "anon-key", options);
    expect(createClientMock).toHaveBeenCalledWith("https://x.supabase.co", "anon-key", options);
  });

  it("works with no options argument", () => {
    createSupabaseClient("https://x.supabase.co", "anon-key");
    expect(createClientMock).toHaveBeenCalledWith("https://x.supabase.co", "anon-key", undefined);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @coffeesnob/supabase test`
Expected: FAIL — `client.ts` doesn't yet accept a third argument, so the "passes through" assertion fails (current `createClient` call omits the options arg).

- [ ] **Step 3: Update `packages/supabase/src/client.ts`**

```typescript
import { createClient, type SupabaseClient, type SupabaseClientOptions } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createSupabaseClient(
  url: string,
  anonKey: string,
  options?: SupabaseClientOptions<"public">
): SupabaseClient<Database> {
  if (!url || !anonKey) {
    throw new Error("createSupabaseClient: both url and anonKey are required");
  }
  return createClient<Database>(url, anonKey, options);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @coffeesnob/supabase test`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/src/client.ts packages/supabase/test/client.test.ts
git commit -m "Let createSupabaseClient accept Supabase auth client options"
```

---

### Task 3: `packages/supabase` — profile queries

**Files:**
- Modify: `packages/supabase/src/queries.ts`
- Modify: `packages/supabase/src/index.ts`
- Modify: `packages/supabase/test/queries.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/supabase/test/queries.test.ts`:

```typescript
import { getProfile, isUsernameAvailable, saveIdentity, saveTastePicks } from "../src/queries";

function fakeSelectEqMaybeSingle(row: unknown) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: row, error: null }),
        }),
      }),
    }),
  } as any;
}

describe("getProfile", () => {
  it("returns the profile row for a user id", async () => {
    const client = fakeSelectEqMaybeSingle({ id: "u1", username: "mara" });
    expect(await getProfile(client, "u1")).toEqual({ id: "u1", username: "mara" });
  });

  it("returns null when no profile row exists", async () => {
    const client = fakeSelectEqMaybeSingle(null);
    expect(await getProfile(client, "missing")).toBeNull();
  });
});

describe("isUsernameAvailable", () => {
  it("is true when no other profile has the username", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            neq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      }),
    } as any;
    expect(await isUsernameAvailable(client, "maradrinks", "u1")).toBe(true);
  });

  it("is false when another profile already has the username", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            neq: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "u2" }, error: null }),
            }),
          }),
        }),
      }),
    } as any;
    expect(await isUsernameAvailable(client, "maradrinks", "u1")).toBe(false);
  });
});

describe("saveIdentity", () => {
  it("updates username and display_name for the given user", async () => {
    const eqSpy = vi.fn(() => Promise.resolve({ error: null }));
    const updateSpy = vi.fn(() => ({ eq: eqSpy }));
    const client = { from: () => ({ update: updateSpy }) } as any;

    await saveIdentity(client, "u1", { username: "maradrinks", displayName: "Mara Köster" });

    expect(updateSpy).toHaveBeenCalledWith({ username: "maradrinks", display_name: "Mara Köster" });
    expect(eqSpy).toHaveBeenCalledWith("id", "u1");
  });

  it("throws when the update errors", async () => {
    const client = {
      from: () => ({
        update: () => ({ eq: () => Promise.resolve({ error: new Error("taken") }) }),
      }),
    } as any;
    await expect(
      saveIdentity(client, "u1", { username: "maradrinks", displayName: "Mara Köster" })
    ).rejects.toThrow("taken");
  });
});

describe("saveTastePicks", () => {
  it("updates taste_picks and stamps onboarded_at", async () => {
    const eqSpy = vi.fn(() => Promise.resolve({ error: null }));
    const updateSpy = vi.fn(() => ({ eq: eqSpy }));
    const client = { from: () => ({ update: updateSpy }) } as any;

    await saveTastePicks(client, "u1", ["espresso", "filter"]);

    const [payload] = updateSpy.mock.calls[0];
    expect(payload.taste_picks).toEqual(["espresso", "filter"]);
    expect(typeof payload.onboarded_at).toBe("string");
    expect(eqSpy).toHaveBeenCalledWith("id", "u1");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @coffeesnob/supabase test`
Expected: FAIL — `getProfile`, `isUsernameAvailable`, `saveIdentity`, `saveTastePicks` don't exist in `../src/queries` yet.

- [ ] **Step 3: Add the query functions to `packages/supabase/src/queries.ts`**

Append to the end of the file:

```typescript
export async function getProfile(client: Client, userId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("id, username, display_name, avatar_url, taste_picks, onboarded_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function isUsernameAvailable(client: Client, username: string, excludingUserId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", excludingUserId)
    .maybeSingle();
  if (error) throw error;
  return data === null;
}

export async function saveIdentity(
  client: Client,
  userId: string,
  params: { username: string; displayName: string }
) {
  const { error } = await client
    .from("profiles")
    .update({ username: params.username, display_name: params.displayName })
    .eq("id", userId);
  if (error) throw error;
}

export async function saveTastePicks(client: Client, userId: string, tastePicks: string[]) {
  const { error } = await client
    .from("profiles")
    .update({ taste_picks: tastePicks, onboarded_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @coffeesnob/supabase test`
Expected: all tests passed (existing `getCities`/`getCityGuide` tests + the new ones)

- [ ] **Step 5: Update `packages/supabase/src/index.ts`**

```typescript
export { createSupabaseClient } from "./client";
export { getCities, getCityGuide, getProfile, isUsernameAvailable, saveIdentity, saveTastePicks } from "./queries";
export type { Database } from "./types";
```

- [ ] **Step 6: Commit**

```bash
git add packages/supabase/src/queries.ts packages/supabase/src/index.ts packages/supabase/test/queries.test.ts
git commit -m "Add profile queries: getProfile, isUsernameAvailable, saveIdentity, saveTastePicks"
```

---

## Phase B — App dependencies & session plumbing

### Task 4: Add `apps/app` dependencies

**Files:**
- Modify: `apps/app/package.json`

- [ ] **Step 1: Install Expo-managed native dependencies**

```bash
cd apps/app && npx expo install expo-secure-store expo-font react-native-svg @react-native-async-storage/async-storage
```

- [ ] **Step 2: Install the session-encryption dependencies**

```bash
cd apps/app && pnpm add aes-js react-native-get-random-values
```

- [ ] **Step 3: Install dev dependencies (types + test runner)**

```bash
cd apps/app && pnpm add -D @types/aes-js vitest
```

- [ ] **Step 4: Add a `test` script to `apps/app/package.json`**

In the `"scripts"` block, add:

```json
"test": "vitest run"
```

- [ ] **Step 5: Verify the workspace still installs cleanly**

Run: `pnpm install`
Expected: exits 0, no errors

- [ ] **Step 6: Commit**

```bash
git add apps/app/package.json pnpm-lock.yaml
git commit -m "Add auth/session dependencies to apps/app"
```

---

### Task 5: `apps/app/lib/large-secure-store.ts`

**Files:**
- Create: `apps/app/lib/large-secure-store.ts`

This is Supabase's own documented pattern for React Native session storage — verbatim from their Expo quickstart, not reinvented. Expo's `SecureStore` can't hold values over 2048 bytes, and a full Supabase session (access token + refresh token + user object) can exceed that, so a random AES-256 key lives in `SecureStore` and the encrypted session itself lives in `AsyncStorage`.

- [ ] **Step 1: Write the file**

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as aesjs from "aes-js";
import "react-native-get-random-values";

export class LargeSecureStore {
  private async _encrypt(key: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));

    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));

    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async _decrypt(key: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) {
      return null;
    }

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1)
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) {
      return null;
    }
    return await this._decrypt(key, encrypted);
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string) {
    const encrypted = await this._encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npx tsc --noEmit`
Expected: exits 0

- [ ] **Step 3: Commit**

```bash
git add apps/app/lib/large-secure-store.ts
git commit -m "Add LargeSecureStore for Supabase session persistence on native"
```

---

### Task 6: Wire the storage adapter into `apps/app/lib/supabase.ts`

**Files:**
- Modify: `apps/app/lib/supabase.ts`

- [ ] **Step 1: Update the file**

```typescript
import "react-native-url-polyfill/auto";
import { createSupabaseClient } from "@coffeesnob/supabase";
import { LargeSecureStore } from "./large-secure-store";

export const supabase = createSupabaseClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: new LargeSecureStore(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  }
);
```

`detectSessionInUrl` is `false` because there's no `window.location` on native to auto-parse; the `reset-password` screen (Task 18) exchanges the recovery code manually. `flowType: "pkce"` is set explicitly so `resetPasswordForEmail` always produces a `?code=` redirect rather than depending on the library's default.

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npx tsc --noEmit`
Expected: exits 0

- [ ] **Step 3: Commit**

```bash
git add apps/app/lib/supabase.ts
git commit -m "Persist Supabase sessions via LargeSecureStore"
```

---

### Task 7: `apps/app/lib/auth/resolve-route-group.ts` (TDD)

**Files:**
- Create: `apps/app/lib/auth/resolve-route-group.ts`
- Create: `apps/app/lib/auth/resolve-route-group.test.ts`

This is the one piece of real branching logic behind auth gating (a security-relevant path), pulled out as a pure function so it's testable without rendering any React Native component.

- [ ] **Step 1: Write the failing test**

Create `apps/app/lib/auth/resolve-route-group.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveRouteGroup } from "./resolve-route-group";

describe("resolveRouteGroup", () => {
  it("sends an unauthenticated user to (auth)", () => {
    expect(resolveRouteGroup({ hasSession: false, isRecoveryRoute: false, onboarded: false })).toBe(
      "(auth)"
    );
  });

  it("sends a password-recovery deep link to reset-password even with no session yet", () => {
    expect(resolveRouteGroup({ hasSession: false, isRecoveryRoute: true, onboarded: false })).toBe(
      "reset-password"
    );
  });

  it("sends a password-recovery deep link to reset-password even for an onboarded, signed-in user", () => {
    expect(resolveRouteGroup({ hasSession: true, isRecoveryRoute: true, onboarded: true })).toBe(
      "reset-password"
    );
  });

  it("sends a signed-in, un-onboarded user to (onboarding)", () => {
    expect(resolveRouteGroup({ hasSession: true, isRecoveryRoute: false, onboarded: false })).toBe(
      "(onboarding)"
    );
  });

  it("sends a signed-in, onboarded user to (tabs)", () => {
    expect(resolveRouteGroup({ hasSession: true, isRecoveryRoute: false, onboarded: true })).toBe(
      "(tabs)"
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/app && npx vitest run lib/auth/resolve-route-group.test.ts`
Expected: FAIL — `./resolve-route-group` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `apps/app/lib/auth/resolve-route-group.ts`:

```typescript
export type RouteGroup = "(auth)" | "reset-password" | "(onboarding)" | "(tabs)";

export function resolveRouteGroup(params: {
  hasSession: boolean;
  isRecoveryRoute: boolean;
  onboarded: boolean;
}): RouteGroup {
  if (params.isRecoveryRoute) return "reset-password";
  if (!params.hasSession) return "(auth)";
  return params.onboarded ? "(tabs)" : "(onboarding)";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/app && npx vitest run lib/auth/resolve-route-group.test.ts`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add apps/app/lib/auth/resolve-route-group.ts apps/app/lib/auth/resolve-route-group.test.ts
git commit -m "Add resolveRouteGroup: the auth-gating decision, as a tested pure function"
```

---

### Task 8: `apps/app/context/auth.tsx` — AuthProvider

**Files:**
- Create: `apps/app/context/auth.tsx`

- [ ] **Step 1: Write the file**

```tsx
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import type { Session } from "@supabase/supabase-js";
import { getProfile, type Database } from "@coffeesnob/supabase";
import { supabase } from "@/lib/supabase";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return value;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    setProfile(await getProfile(supabase, userId));
  }

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (cancelled) return;
      setSession(initialSession);
      if (initialSession) await loadProfile(initialSession.user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        await loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function refreshProfile() {
    if (session) await loadProfile(session.user.id);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npx tsc --noEmit`
Expected: exits 0

- [ ] **Step 3: Commit**

```bash
git add apps/app/context/auth.tsx
git commit -m "Add AuthProvider: session + profile + loading, via onAuthStateChange"
```

---

## Phase C — Fonts & primitives

### Task 9: Bundle the Area font files into `apps/app`

**Files:**
- Create: `apps/app/assets/fonts/area-normal/*.otf` (4 files)

The same 4 files were already fetched into `apps/web/public/fonts/area-normal/` during project setup — copy them locally rather than re-fetching from the design project.

- [ ] **Step 1: Copy the font files**

```bash
mkdir -p apps/app/assets/fonts/area-normal
cp apps/web/public/fonts/area-normal/*.otf apps/app/assets/fonts/area-normal/
```

- [ ] **Step 2: Verify**

Run: `ls apps/app/assets/fonts/area-normal/`
Expected: all 4 `.otf` files present (`fonnts.com-Area_Extended_Black.otf`, `fonnts.com-Area_Extended_Bold.otf`, `fonnts.com-Area_Normal_Bold.otf`, `fonnts.com-Area_Normal_Regular.otf`)

- [ ] **Step 3: Commit**

```bash
git add apps/app/assets/fonts
git commit -m "Bundle Area typeface into apps/app"
```

---

### Task 10: `apps/app/components/primitives.tsx`

**Files:**
- Create: `apps/app/components/primitives.tsx`

Only what the auth/onboarding screens use — `Script` logo, `Avatar`, `Eyebrow`, the type scale, and the two button styles — ported from `styles.css`/`_primitives.jsx` in the Claude Design project. Not the full `Icon` set.

- [ ] **Step 1: Write the file**

```tsx
import { Text, View, Pressable, StyleSheet, type TextProps, type PressableProps } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@coffeesnob/design-tokens";

const SCRIPT_PATHS = [
  "M225.65,137.69c-18.03,0-37.26,23.32-43.75,49.06-.1.4-.32.75-.63,1.01-.45.39-.92,1.02-1.52,1.97-11.81,23.28-17.79,29.76-21.78,29.59-3.66-.16-3.33-4.49-.33-11.97,10.31-25.11,21.28-47.22,21.28-59.19,0-6.32-3.33-10.31-9.64-10.31-8.98,0-19.62,8.81-35.08,35.75-1,1.83-2.16,2.33-2.83,2.33s-1.33-.66-.33-3.16l5.32-13.63c2.33-5.99,3.99-9.81,3.99-13.3.17-4.16-1.16-7.65-7.65-7.81-9.41-.31-20.39,17.69-29.23,35.7-.74,1.51-2.92,1.52-3.65,0-3.6-7.54-9.25-14.32-15.03-19.9-8.81-8.81-17.79-19.95-17.79-31.09s10.97-27.93,27.1-27.93c21.11,0,24.44,7.65,18.95,38.74-.17,1.5.17,2.33,1,2.33s1.5-1,2-2.49c1.66-6.32,4.16-24.44,8.65-38.9.33-1.33,0-2-.83-2-1.5,0-4.49.83-7.81.83-5.82,0-9.81-1.5-19.62-1.5-21.61,0-38.41,18.12-38.41,36.41,0,12.64,9.14,24.94,18.62,34.08,9.14,8.81,17.79,20.95,17.79,32.92,0,15.63-12.14,31.92-30.76,31.92s-23.77-8.15-23.77-27.27c0-4.49.33-9.64.66-15.63.17-1-.5-1.33-1.16-1.33s-1.33.5-1.66,1.33c-2,7.65-2.16,30.09-6.15,43.23-.67,1.5-.17,2,.66,2,1.66,0,4.66-.83,8.81-.83,4.82,0,11.97,1.5,18.45,1.5,25.77,0,44.22-17.46,44.22-40.4,0-2.77-.38-5.48-1.04-8.13-.17-.68.05-1.37.52-1.89.38-.42.76-1.05,1.22-1.95,11.3-23.44,18.45-30.09,22.45-29.93,3.66,0,3.49,4.49.66,11.97l-19.29,55.03c-3.82,11.31-1.66,14.8,3.16,14.8,3.99,0,7.48-2,8.48-5.32,1-3.49-1.16-9.48,2.99-22.28,11.97-34.75,32.75-56.53,41.73-56.53,2.66,0,3.99,2,3.99,6.15,0,8.65-11.31,32.42-20.62,55.86-2.16,5.98-3.33,10.14-3.49,13.47-.16,4.16.83,7.81,7.48,8.15,7.74.38,16.05-11.62,23.77-25.75,1.02-1.87,3.85-1.15,3.85.97h0c0,15.46,6.98,25.27,19.29,25.27,22.28,0,46.39-34.58,46.39-66.01,0-15.46-7.32-25.94-19.62-25.94ZM201.87,225.15c-8.81,0-11.97-8.65-11.97-20.12,0-27.93,17.62-62.85,32.75-62.85,8.81,0,12.14,9.14,12.14,20.62,0,28.1-17.79,62.35-32.92,62.35Z",
  "M292.99,137.86c-10.31,0-22.11,16.79-31.92,34.75-1.16,2-1.83,2.33-2.66,2.33s-1.16-1-.5-2.83l12.64-32.75c4.49-11.8,11.14-31.42,17.29-47.05.83-2.16.83-2.83-.83-2.83-1.83,0-3.82,1.33-6.32,2.49-4.99,2.83-17.12,3.49-21.28,3.49-1.83,0-2.83.33-2.83,1.5,0,1,.83,1.16,2.16,1.16,2.33,0,4.32-.17,7.98-.17,7.32,0,6.48,4.32,4.16,11.31l-31.59,94.6c-3.82,11.14-7.81,16.96-7.81,19.12,0,2.83,15.63,6.65,25.44,6.65,28.43,0,48.05-42.9,48.05-71.82,0-11.64-3.33-19.95-11.97-19.95ZM257.91,226.14c-7.15,0-14.3-5.32-12.3-10.97l7.32-20.78c6.65-19.62,24.61-47.72,35.75-47.72,4.82,0,6.32,4.82,6.32,13.3,0,25.77-15.3,66.17-37.08,66.17Z",
];

export function ScriptLogo({ height = 26, color = colors.teal }: { height?: number; color?: string }) {
  const width = height * (288 / 178);
  return (
    <Svg height={height} width={width} viewBox="22 82 288 178" fill={color}>
      {SCRIPT_PATHS.map((d, i) => (
        <Path key={i} d={d} />
      ))}
    </Svg>
  );
}

export function IconBack({ size = 21, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="square">
      <Path d="M14.5 4.5 7 12l7.5 7.5" />
    </Svg>
  );
}

export function IconCheck({ size = 17, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="square">
      <Path d="M4.5 12.5 9.5 17.5 19.5 7" />
    </Svg>
  );
}

export function Avatar({
  name = "AB",
  size = 28,
  bg = colors.sageDk,
  fg = colors.paper,
}: {
  name?: string;
  size?: number;
  bg?: string;
  fg?: string;
}) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={{ color: fg, fontFamily: "AreaExtended-Black", fontSize: size * 0.34 }}>{initials}</Text>
    </View>
  );
}

export function Eyebrow({ children, color = colors.ink3 }: { children: string; color?: string }) {
  return (
    <View style={styles.eyebrowRow}>
      <Text style={[styles.label, { color }]}>{children}</Text>
      <View style={styles.eyebrowRule} />
    </View>
  );
}

export function D1(props: TextProps) {
  return <Text {...props} style={[styles.d1, props.style]} />;
}
export function D2(props: TextProps) {
  return <Text {...props} style={[styles.d2, props.style]} />;
}
export function D4(props: TextProps) {
  return <Text {...props} style={[styles.d4, props.style]} />;
}
export function Body(props: TextProps) {
  return <Text {...props} style={[styles.body, props.style]} />;
}
export function BodySm(props: TextProps) {
  return <Text {...props} style={[styles.bodySm, props.style]} />;
}
export function Label(props: TextProps) {
  return <Text {...props} style={[styles.label, props.style]} />;
}

export function ButtonOx({ title, style, ...rest }: { title: string } & PressableProps) {
  return (
    <Pressable {...rest} style={[styles.btn, styles.btnOx, style as object]}>
      <Text style={styles.btnOxText}>{title}</Text>
    </Pressable>
  );
}

export function ButtonLine({ title, style, ...rest }: { title: string } & PressableProps) {
  return (
    <Pressable {...rest} style={[styles.btn, styles.btnLine, style as object]}>
      <Text style={styles.btnLineText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center", flexShrink: 0 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  eyebrowRule: { flex: 1, height: 1, backgroundColor: colors.rule },
  d1: { fontFamily: "Area-Bold", fontSize: 40, lineHeight: 37, letterSpacing: -1.4, color: colors.ink },
  d2: { fontFamily: "Area-Bold", fontSize: 30, lineHeight: 28, letterSpacing: -0.96, color: colors.ink },
  d4: { fontFamily: "Area-Bold", fontSize: 17, lineHeight: 18, letterSpacing: -0.4, color: colors.ink },
  body: { fontFamily: "Area-Regular", fontSize: 13.5, lineHeight: 19.6, color: colors.ink },
  bodySm: { fontFamily: "Area-Regular", fontSize: 12, lineHeight: 16.8, color: colors.ink3 },
  label: {
    fontFamily: "AreaExtended-Bold",
    fontSize: 8.5,
    letterSpacing: 1.19,
    textTransform: "uppercase",
    color: colors.ink3,
  },
  btn: { height: 46, borderRadius: 2, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  btnOx: { backgroundColor: colors.oxblood },
  btnOxText: {
    fontFamily: "AreaExtended-Black",
    fontSize: 10.5,
    letterSpacing: 1.05,
    textTransform: "uppercase",
    color: colors.cream,
  },
  btnLine: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.ink },
  btnLineText: {
    fontFamily: "AreaExtended-Black",
    fontSize: 10.5,
    letterSpacing: 1.05,
    textTransform: "uppercase",
    color: colors.ink,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npx tsc --noEmit`
Expected: exits 0 (will only fully pass once `react-native-svg` and `@coffeesnob/design-tokens` resolve — both already true after Task 4 and from the existing workspace)

- [ ] **Step 3: Commit**

```bash
git add apps/app/components/primitives.tsx
git commit -m "Port Script logo, Avatar, Eyebrow, type scale, and buttons to React Native"
```

---

## Phase D — Root routing

### Task 11: Rewrite `apps/app/app/_layout.tsx`

**Files:**
- Modify: `apps/app/app/_layout.tsx`

- [ ] **Step 1: Write the new root layout**

```tsx
import { useEffect } from "react";
import { Stack, SplashScreen, usePathname } from "expo-router";
import { useFonts } from "expo-font";
import { AuthProvider, useAuth } from "@/context/auth";
import { resolveRouteGroup } from "@/lib/auth/resolve-route-group";

SplashScreen.preventAutoHideAsync();

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { session, profile, loading } = useAuth();
  const pathname = usePathname();
  const ready = fontsLoaded && !loading;

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  const group = resolveRouteGroup({
    hasSession: !!session,
    isRecoveryRoute: pathname === "/reset-password",
    onboarded: !!profile?.onboarded_at,
  });

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={group === "(auth)"}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={group === "reset-password"}>
        <Stack.Screen name="reset-password" />
      </Stack.Protected>
      <Stack.Protected guard={group === "(onboarding)"}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={group === "(tabs)"}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Area-Regular": require("../assets/fonts/area-normal/fonnts.com-Area_Normal_Regular.otf"),
    "Area-Bold": require("../assets/fonts/area-normal/fonnts.com-Area_Normal_Bold.otf"),
    "AreaExtended-Bold": require("../assets/fonts/area-normal/fonnts.com-Area_Extended_Bold.otf"),
    "AreaExtended-Black": require("../assets/fonts/area-normal/fonnts.com-Area_Extended_Black.otf"),
  });

  return (
    <AuthProvider>
      <RootNavigator fontsLoaded={fontsLoaded} />
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npx tsc --noEmit`
Expected: exits 0

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/_layout.tsx
git commit -m "Route between (auth)/(onboarding)/(tabs)/reset-password via Stack.Protected"
```

---

### Task 12: `(auth)` and `(onboarding)` group layouts

**Files:**
- Create: `apps/app/app/(auth)/_layout.tsx`
- Create: `apps/app/app/(onboarding)/_layout.tsx`

- [ ] **Step 1: Write `apps/app/app/(auth)/_layout.tsx`**

```tsx
import { Stack } from "expo-router";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Write `apps/app/app/(onboarding)/_layout.tsx`**

```tsx
import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 3: Commit**

```bash
git add "apps/app/app/(auth)/_layout.tsx" "apps/app/app/(onboarding)/_layout.tsx"
git commit -m "Add (auth) and (onboarding) group layouts"
```

---

## Phase E — Auth screens

### Task 13: Sign in

**Files:**
- Create: `apps/app/app/(auth)/sign-in.tsx`

- [ ] **Step 1: Write the screen**

```tsx
import { useState } from "react";
import { View, TextInput, StyleSheet, Pressable, Text } from "react-native";
import { Link, router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { supabase } from "@/lib/supabase";
import { ScriptLogo, D1, Body, BodySm, ButtonOx, Label } from "@/components/primitives";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      if (signInError.message.toLowerCase().includes("email not confirmed")) {
        router.push({ pathname: "/check-email", params: { reason: "confirm" } });
        return;
      }
      setError(signInError.message);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <ScriptLogo height={40} color={colors.oxblood} />
        <D1 style={styles.headline}>Find coffee worth{"\n"}the detour.</D1>
        <Body style={styles.subhead}>
          A locator kept by the people who drink it. Sign in to pick up where you left off.
        </Body>
      </View>

      <View style={styles.form}>
        <Label style={styles.fieldLabel}>Email</Label>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          testID="sign-in-email"
        />

        <View style={styles.passwordRow}>
          <Label style={styles.fieldLabel}>Password</Label>
          <Link href="/forgot-password" replace>
            <Label style={styles.link}>Forgotten?</Label>
          </Link>
        </View>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          testID="sign-in-password"
        />

        {error && <BodySm style={styles.error}>{error}</BodySm>}

        <ButtonOx
          title={loading ? "Signing in…" : "Continue"}
          onPress={onSubmit}
          disabled={loading}
          style={styles.submit}
        />
      </View>

      <View style={styles.footer}>
        <BodySm style={{ color: colors.ink3 }}>New here? </BodySm>
        <Link href="/sign-up" replace>
          <Label style={styles.link}>Create an account</Label>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  header: { backgroundColor: colors.sage, padding: 24, paddingTop: 60, paddingBottom: 30 },
  headline: { color: colors.oxblood, marginTop: 22, fontSize: 32 },
  subhead: { color: colors.oxblood, opacity: 0.8, marginTop: 12, maxWidth: 280 },
  form: { flex: 1, padding: 24, paddingTop: 26 },
  fieldLabel: { marginBottom: 8 },
  input: { borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 9, fontSize: 15, color: colors.ink },
  passwordRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 18,
    marginBottom: 8,
  },
  link: { color: colors.tealDk },
  error: { color: colors.oxblood, marginTop: 12 },
  submit: { marginTop: 22 },
  footer: { padding: 24, paddingBottom: 30, flexDirection: "row", justifyContent: "center" },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npx tsc --noEmit`
Expected: exits 0

- [ ] **Step 3: Commit**

```bash
git add "apps/app/app/(auth)/sign-in.tsx"
git commit -m "Add Sign In screen"
```

---

### Task 14: Sign up

**Files:**
- Create: `apps/app/app/(auth)/sign-up.tsx`

- [ ] **Step 1: Write the screen**

```tsx
import { useState } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { Link, router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { supabase } from "@/lib/supabase";
import { D1, Body, BodySm, ButtonOx, Label } from "@/components/primitives";

export default function SignUpScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (!data.session) {
      router.push({ pathname: "/check-email", params: { reason: "confirm" } });
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <D1 style={styles.headline}>Create an{"\n"}account.</D1>
        <Body style={styles.subhead}>Onboarding takes about a minute after this.</Body>
      </View>

      <View style={styles.form}>
        <Label style={styles.fieldLabel}>Email</Label>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Label style={[styles.fieldLabel, styles.passwordLabel]}>Password</Label>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />

        {error && <BodySm style={styles.error}>{error}</BodySm>}

        <ButtonOx
          title={loading ? "Creating…" : "Continue"}
          onPress={onSubmit}
          disabled={loading}
          style={styles.submit}
        />
      </View>

      <View style={styles.footer}>
        <BodySm style={{ color: colors.ink3 }}>Already have an account? </BodySm>
        <Link href="/sign-in" replace>
          <Label style={styles.link}>Sign in</Label>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  header: { backgroundColor: colors.sage, padding: 24, paddingTop: 60, paddingBottom: 30 },
  headline: { color: colors.oxblood, fontSize: 32 },
  subhead: { color: colors.oxblood, opacity: 0.8, marginTop: 12, maxWidth: 280 },
  form: { flex: 1, padding: 24, paddingTop: 26 },
  fieldLabel: { marginBottom: 8 },
  passwordLabel: { marginTop: 18 },
  input: { borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 9, fontSize: 15, color: colors.ink },
  error: { color: colors.oxblood, marginTop: 12 },
  submit: { marginTop: 22 },
  link: { color: colors.tealDk },
  footer: { padding: 24, paddingBottom: 30, flexDirection: "row", justifyContent: "center" },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npx tsc --noEmit`
Expected: exits 0

- [ ] **Step 3: Commit**

```bash
git add "apps/app/app/(auth)/sign-up.tsx"
git commit -m "Add Sign Up screen"
```

---

### Task 15: Check email

**Files:**
- Create: `apps/app/app/(auth)/check-email.tsx`

One screen reused for both post-signup confirmation and post-reset-request, distinguished by a `reason` param.

- [ ] **Step 1: Write the screen**

```tsx
import { View, StyleSheet } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { D2, Body, Label } from "@/components/primitives";

export default function CheckEmailScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const isReset = reason === "reset";

  return (
    <View style={styles.screen}>
      <D2 style={styles.headline}>Check your email.</D2>
      <Body style={styles.body}>
        {isReset
          ? "We sent a link to reset your password. Open it on this device to continue."
          : "We sent a confirmation link. Open it, then come back and sign in."}
      </Body>
      <Link href="/sign-in" replace style={styles.link}>
        <Label style={{ color: colors.tealDk }}>Back to sign in</Label>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, padding: 24, paddingTop: 100, alignItems: "flex-start" },
  headline: { marginBottom: 14 },
  body: { maxWidth: 280, marginBottom: 24 },
  link: { marginTop: 8 },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npx tsc --noEmit`
Expected: exits 0

- [ ] **Step 3: Commit**

```bash
git add "apps/app/app/(auth)/check-email.tsx"
git commit -m "Add Check Email screen (signup confirmation + reset request)"
```

---

### Task 16: Forgot password

**Files:**
- Create: `apps/app/app/(auth)/forgot-password.tsx`

- [ ] **Step 1: Write the screen**

```tsx
import { useState } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { supabase } from "@/lib/supabase";
import { D2, Body, BodySm, ButtonOx, Label } from "@/components/primitives";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "coffeesnob://reset-password",
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    router.push({ pathname: "/check-email", params: { reason: "reset" } });
  }

  return (
    <View style={styles.screen}>
      <D2 style={styles.headline}>Reset your password.</D2>
      <Body style={styles.body}>We'll email you a link to set a new one.</Body>

      <Label style={styles.fieldLabel}>Email</Label>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      {error && <BodySm style={styles.error}>{error}</BodySm>}

      <ButtonOx
        title={loading ? "Sending…" : "Send reset link"}
        onPress={onSubmit}
        disabled={loading}
        style={styles.submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, padding: 24, paddingTop: 100 },
  headline: { marginBottom: 14 },
  body: { maxWidth: 280, marginBottom: 26 },
  fieldLabel: { marginBottom: 8 },
  input: { borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 9, fontSize: 15, color: colors.ink },
  error: { color: colors.oxblood, marginTop: 12 },
  submit: { marginTop: 22 },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npx tsc --noEmit`
Expected: exits 0

- [ ] **Step 3: Commit**

```bash
git add "apps/app/app/(auth)/forgot-password.tsx"
git commit -m "Add Forgot Password screen"
```

---

### Task 17: Reset password (top-level, deep-link target)

**Files:**
- Create: `apps/app/app/reset-password.tsx`

Deliberately **not** inside `(auth)` — it's reached via a deep link while `resolveRouteGroup` reports `"reset-password"` regardless of whether a session exists yet, so it must be its own top-level route matching `/reset-password` exactly (Task 11's `pathname === "/reset-password"` check).

- [ ] **Step 1: Write the screen**

```tsx
import { useEffect, useState } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { supabase } from "@/lib/supabase";
import { D2, Body, BodySm, ButtonOx, Label } from "@/components/primitives";

export default function ResetPasswordScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [exchanging, setExchanging] = useState(true);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!code) {
      setExchangeError("This reset link is missing its code. Request a new one.");
      setExchanging(false);
      return;
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) setExchangeError(error.message);
      setExchanging(false);
    });
  }, [code]);

  async function onSubmit() {
    setSubmitError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    router.replace("/");
  }

  if (exchanging) {
    return (
      <View style={styles.screen}>
        <Body>Verifying your link…</Body>
      </View>
    );
  }

  if (exchangeError) {
    return (
      <View style={styles.screen}>
        <D2 style={styles.headline}>That link didn't work.</D2>
        <BodySm style={styles.error}>{exchangeError}</BodySm>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <D2 style={styles.headline}>Set a new password.</D2>

      <Label style={styles.fieldLabel}>New password</Label>
      <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />

      {submitError && <BodySm style={styles.error}>{submitError}</BodySm>}

      <ButtonOx
        title={submitting ? "Saving…" : "Save password"}
        onPress={onSubmit}
        disabled={submitting}
        style={styles.submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, padding: 24, paddingTop: 100 },
  headline: { marginBottom: 20 },
  fieldLabel: { marginBottom: 8 },
  input: { borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 9, fontSize: 15, color: colors.ink },
  error: { color: colors.oxblood, marginTop: 12 },
  submit: { marginTop: 22 },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npx tsc --noEmit`
Expected: exits 0

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/reset-password.tsx
git commit -m "Add Reset Password screen (PKCE code exchange from deep link)"
```

---

## Phase F — Onboarding screens

### Task 18: Onboarding · Identity

**Files:**
- Create: `apps/app/app/(onboarding)/identity.tsx`

- [ ] **Step 1: Write the screen**

```tsx
import { useEffect, useState } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { isUsernameAvailable, saveIdentity } from "@coffeesnob/supabase";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { D1, Body, BodySm, Label, Avatar, ButtonOx, Eyebrow } from "@/components/primitives";

export default function IdentityScreen() {
  const { session, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed || !session) {
      setAvailability("idle");
      return;
    }
    setAvailability("checking");
    const timeout = setTimeout(async () => {
      const available = await isUsernameAvailable(supabase, trimmed, session.user.id);
      setAvailability(available ? "available" : "taken");
    }, 500);
    return () => clearTimeout(timeout);
  }, [username, session]);

  async function onSubmit() {
    if (!session) return;
    setError(null);
    setSaving(true);
    try {
      await saveIdentity(supabase, session.user.id, {
        username: username.trim(),
        displayName: displayName.trim(),
      });
      await refreshProfile();
      router.push("/taste");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = username.trim().length > 0 && displayName.trim().length > 0 && availability !== "taken";

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Label style={styles.step}>Step one · You</Label>
        <D1 style={styles.headline}>First, what{"\n"}we call you.</D1>
        <Body style={styles.subhead}>Your handle is how members find you and credit your notes.</Body>
      </View>

      <View style={styles.form}>
        <Label style={styles.fieldLabel}>Name</Label>
        <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} />

        <View style={styles.usernameRow}>
          <Label style={styles.fieldLabel}>Handle</Label>
          {availability === "checking" && <Label style={{ color: colors.ink3 }}>Checking…</Label>}
          {availability === "available" && <Label style={{ color: colors.tealDk }}>Available</Label>}
          {availability === "taken" && <Label style={{ color: colors.oxblood }}>Already taken</Label>}
        </View>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={(v) => setUsername(v.replace(/\s/g, "").toLowerCase())}
          autoCapitalize="none"
        />

        <View style={styles.preview}>
          <Eyebrow>You'll appear as</Eyebrow>
          <View style={styles.previewRow}>
            <Avatar name={displayName || "?"} size={44} bg={colors.burnt} fg={colors.ink} />
            <View>
              <D1 style={styles.previewName}>{displayName || "Your name"}</D1>
              <BodySm style={{ color: colors.ink3 }}>@{username || "handle"}</BodySm>
            </View>
          </View>
        </View>

        {error && <BodySm style={styles.error}>{error}</BodySm>}
      </View>

      <View style={styles.footer}>
        <ButtonOx
          title={saving ? "Saving…" : "Continue"}
          onPress={onSubmit}
          disabled={!canSubmit || saving}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  header: { backgroundColor: colors.sage, padding: 22, paddingTop: 60, paddingBottom: 22 },
  step: { color: colors.oxblood, opacity: 0.7 },
  headline: { color: colors.burnt, marginTop: 11, fontSize: 34 },
  subhead: { color: colors.oxblood, marginTop: 11, maxWidth: 290, opacity: 0.85 },
  form: { flex: 1, padding: 22, paddingTop: 22 },
  fieldLabel: { marginBottom: 8 },
  usernameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 18 },
  input: { borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 9, fontSize: 15, color: colors.ink },
  preview: { marginTop: 26 },
  previewRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: 14,
    marginTop: 10,
  },
  previewName: { fontSize: 17, lineHeight: 18 },
  error: { color: colors.oxblood, marginTop: 16 },
  footer: { padding: 22, paddingBottom: 30 },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npx tsc --noEmit`
Expected: exits 0

- [ ] **Step 3: Commit**

```bash
git add "apps/app/app/(onboarding)/identity.tsx"
git commit -m "Add Onboarding · Identity screen"
```

---

### Task 19: Onboarding · Taste

**Files:**
- Create: `apps/app/app/(onboarding)/taste.tsx`

- [ ] **Step 1: Write the screen**

```tsx
import { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { saveTastePicks } from "@coffeesnob/supabase";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { D1, D4, Body, BodySm, Label, ButtonOx, IconCheck } from "@/components/primitives";

const OPTIONS = [
  { id: "espresso", label: "Espresso, standing", sub: "Single or ristretto, down at the bar." },
  { id: "filter", label: "Filter, sitting", sub: "V60, Aeropress, batch. The slower the better." },
  { id: "milk", label: "Milk drinks", sub: "Cortado, flat white, the occasional cappuccino." },
  { id: "iced", label: "Cold", sub: "Cold brew, iced filter, oat shaken." },
  { id: "trust", label: "Whatever's on bar", sub: "You'd rather the barista chose." },
];

export default function TasteScreen() {
  const { session, refreshProfile } = useAuth();
  const [picks, setPicks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function onSubmit() {
    if (!session) return;
    setError(null);
    setSaving(true);
    try {
      await saveTastePicks(supabase, session.user.id, picks);
      await refreshProfile();
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Label style={styles.step}>Step two · Taste</Label>
        <D1 style={styles.headline}>Tell us how{"\n"}you take it.</D1>
        <Body style={styles.subhead}>
          We'll shape the guide around you — and put the shops that do your thing well at the top of the map.
        </Body>
      </View>

      <View style={styles.list}>
        {OPTIONS.map((o) => {
          const on = picks.includes(o.id);
          return (
            <Pressable key={o.id} onPress={() => toggle(o.id)} style={[styles.row, on && styles.rowOn]}>
              <View style={[styles.checkbox, on && styles.checkboxOn]}>{on && <IconCheck size={13} color={colors.cream} />}</View>
              <View style={styles.rowText}>
                <D4>{o.label}</D4>
                <BodySm style={{ color: colors.ink3, marginTop: 5 }}>{o.sub}</BodySm>
              </View>
            </Pressable>
          );
        })}
        {error && <BodySm style={styles.error}>{error}</BodySm>}
      </View>

      <View style={styles.footer}>
        <ButtonOx title={saving ? "Saving…" : "Continue"} onPress={onSubmit} disabled={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  header: { backgroundColor: colors.sage, padding: 22, paddingTop: 60, paddingBottom: 22 },
  step: { color: colors.oxblood, opacity: 0.7 },
  headline: { color: colors.burnt, marginTop: 11, fontSize: 34 },
  subhead: { color: colors.oxblood, marginTop: 11, maxWidth: 290, opacity: 0.85 },
  list: { flex: 1 },
  row: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    padding: 16,
    paddingHorizontal: 22,
  },
  rowOn: { backgroundColor: colors.card },
  checkbox: {
    width: 20,
    height: 20,
    marginTop: 2,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: colors.ink3,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { borderWidth: 0, backgroundColor: colors.oxblood },
  rowText: { flex: 1 },
  error: { color: colors.oxblood, margin: 22, marginBottom: 0 },
  footer: { padding: 22, paddingBottom: 30 },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && npx tsc --noEmit`
Expected: exits 0

- [ ] **Step 3: Commit**

```bash
git add "apps/app/app/(onboarding)/taste.tsx"
git commit -m "Add Onboarding · Taste screen"
```

---

### Task 20: Temporary sign-out button on the Profile tab stub

**Files:**
- Modify: `apps/app/app/(tabs)/profile.tsx`

The real Profile screen is next sub-project's work. This is one button on the existing stub so the full auth loop (sign in → onboard → sign out → back to sign in) is actually exercisable for verification in Task 21 — not a build-out of the profile screen itself.

- [ ] **Step 1: Read the current stub**

Run: `cat "apps/app/app/(tabs)/profile.tsx"`

- [ ] **Step 2: Add a sign-out button**

Replace its contents with:

```tsx
import { View, Text, Pressable } from "react-native";
import { useAuth } from "@/context/auth";

export default function ProfileScreen() {
  const { signOut } = useAuth();
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

- [ ] **Step 3: Typecheck**

Run: `cd apps/app && npx tsc --noEmit`
Expected: exits 0

- [ ] **Step 4: Commit**

```bash
git add "apps/app/app/(tabs)/profile.tsx"
git commit -m "Add temporary sign-out button to Profile stub for auth verification"
```

---

## Phase G — Verification

### Task 21: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck and test every touched package**

```bash
pnpm --filter @coffeesnob/supabase test
pnpm --filter @coffeesnob/supabase typecheck
cd apps/app && npx vitest run && npx tsc --noEmit
```

Expected: all green.

- [ ] **Step 2: Start the app for web**

```bash
cd apps/app && npx expo start --web
```

Expected: builds and opens in the browser with no errors in the terminal or browser console.

- [ ] **Step 3: Walk the sign-up path**

In the running app: Sign Up with a fresh email/password → land on Check Email → in the Supabase Dashboard (Authentication → Users), manually confirm the user (or use a real inbox if `EXPO_PUBLIC_SUPABASE_URL` points at a project with real email sending) → return to Sign In → sign in with the same credentials.
Expected: lands on Onboarding · Identity (not Home) — this is a brand-new, un-onboarded user.

- [ ] **Step 4: Walk onboarding**

Enter a name and handle, confirm the "Available"/"Taken" indicator reacts as you type, submit → lands on Onboarding · Taste. Pick a few options, submit.
Expected: lands on the Home tab (`(tabs)`), tab bar visible.

- [ ] **Step 5: Verify session persistence**

Reload the page (web) or fully restart the app (native).
Expected: still on `(tabs)`, no flash of the sign-in screen — the session persisted and profile loaded before the first paint.

- [ ] **Step 6: Sign out and back in**

Go to the Profile tab, tap "Sign out."
Expected: lands on Sign In. Sign in again with the same (now-onboarded) account.
Expected: lands directly on `(tabs)` — `onboarded_at` is set, so onboarding is skipped this time.

- [ ] **Step 7: Walk the password-reset path**

From Sign In, tap "Forgotten?" → enter the test account's email → submit → lands on Check Email (reset copy). In the Supabase Dashboard, find the generated recovery link for that user (Authentication → Users → the user → "Send recovery email" or copy the link from logs, since real email delivery may not be configured in dev) and open it in the same browser tab (or paste the `coffeesnob://reset-password?code=...` URL into the running native app via a deep link if testing on-device).
Expected: lands on "Set a new password," not stuck on "Verifying your link…" or an error. Submit a new password.
Expected: routes to `(tabs)` (session already existed for this onboarded user).

- [ ] **Step 8: Confirm no regressions in `apps/web`**

```bash
pnpm --filter web build
```

Expected: `Compiled successfully` — the `packages/supabase` client-options change didn't break the web app, which still calls `createSupabaseClient` with two arguments.

---

## After Task 21: finish the branch

Once every step above is green, use the **superpowers:finishing-a-development-branch** skill to decide how `feat/auth-session` gets merged into `main` (the project convention is: only merge once tested and done, per Step 1 above).
