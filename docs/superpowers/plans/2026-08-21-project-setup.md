# Coffee Snob Project Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Coffee Snob monorepo (Next.js marketing site + Expo product app + Supabase backend), port the real design (from Claude Design project `019df027-97af-74d2-a376-2a823fc1ddc5`) into working code, and get the marketing site deployed to Vercel against the real Supabase project.

**Architecture:** Turborepo + pnpm monorepo. `apps/web` (Next.js 15 App Router, TS) serves the marketing site — Landing, City Guides (Supabase-backed), Journal (git/MDX-backed). `apps/app` (Expo + Expo Router, TS) is scaffolded as a navigation shell only this pass — full screen porting is future work. `packages/design-tokens` holds the ported color/type system. `packages/supabase` holds the shared client and typed query helpers. `supabase/` holds SQL migrations and seed data.

**Tech Stack:** TypeScript, Next.js 15 (App Router), Expo (SDK 52, Expo Router), Supabase (Postgres + Auth), Turborepo, pnpm, Vitest, `gray-matter` + `next-mdx-remote` for MDX.

See `docs/superpowers/specs/2026-08-21-project-setup-design.md` for the full rationale behind these choices.

---

## Phase A — Monorepo skeleton

### Task 1: Root workspace config

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.nvmrc`

- [ ] **Step 1: Write root `package.json`**

```json
{
  "name": "coffee-snob",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2.3.3",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Write `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "lint": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules/
.turbo/
.next/
dist/
.expo/
*.log
.env
.env.local
.DS_Store
```

- [ ] **Step 5: Write `.nvmrc`**

```
20
```

- [ ] **Step 6: Install and verify the workspace resolves (will show "No packages found" — expected, none exist yet)**

Run: `pnpm install`
Expected: completes with no error (root has no dependencies to conflict with yet)

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json .gitignore .nvmrc
git commit -m "Add monorepo root config (pnpm workspaces + Turborepo)"
```

---

### Task 2: `apps/web` — Next.js scaffold

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/globals.css`

- [ ] **Step 1: Write `apps/web/package.json`**

```json
{
  "name": "web",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^15.1.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@coffeesnob/design-tokens": "workspace:*",
    "@coffeesnob/supabase": "workspace:*",
    "gray-matter": "^4.0.3",
    "next-mdx-remote": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Write `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `apps/web/next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

- [ ] **Step 4: Write `apps/web/app/globals.css`** (placeholder ground — real design tokens land in Task 9)

```css
:root {
  --paper: #f0ecdf;
  --ink: #161310;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
}
```

- [ ] **Step 5: Write `apps/web/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coffee Snob — Find coffee worth the detour",
  description:
    "A curated guide to specialty coffee, city by city. Five to ten shops per city, chosen against written standards, not crowdsourced ratings.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Write `apps/web/app/page.tsx`**

```tsx
export default function HomePage() {
  return <main>Coffee Snob — under construction</main>;
}
```

- [ ] **Step 7: Verify the app builds**

Run: `pnpm --filter web install && pnpm --filter web build`
Expected: `Compiled successfully`, exits 0

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "Scaffold apps/web (Next.js 15 App Router)"
```

---

### Task 3: `apps/app` — Expo scaffold

**Files:**
- Create: `apps/app/package.json` (generated, then edited)
- Create: `apps/app/app/_layout.tsx`
- Create: `apps/app/app/(tabs)/_layout.tsx`
- Create: `apps/app/app/(tabs)/index.tsx`
- Create: `apps/app/app/(tabs)/map.tsx`
- Create: `apps/app/app/(tabs)/log.tsx`
- Create: `apps/app/app/(tabs)/lists.tsx`
- Create: `apps/app/app/(tabs)/profile.tsx`
- Create: `apps/app/app.json`

- [ ] **Step 1: Generate the Expo app**

Run (from repo root):
```bash
npx create-expo-app@latest apps/app --template blank-typescript
```
Expected: creates `apps/app` with a default Expo project

- [ ] **Step 2: Add Expo Router and its peer deps**

Run:
```bash
cd apps/app && npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar react-native-web react-dom @expo/metro-runtime
```

- [ ] **Step 3: Edit `apps/app/package.json`** — set the entry point and rename

```json
{
  "name": "app",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "web": "expo start --web",
    "build:web": "expo export -p web",
    "typecheck": "tsc --noEmit"
  }
}
```
(keep the `dependencies`/`devDependencies` that `create-expo-app` and `expo install` already wrote — only add/change the fields above)

- [ ] **Step 4: Edit `apps/app/app.json`** — add the `scheme` Expo Router requires and enable web output

```json
{
  "expo": {
    "name": "Coffee Snob",
    "slug": "coffee-snob",
    "scheme": "coffeesnob",
    "web": { "bundler": "metro", "output": "single" },
    "plugins": ["expo-router"]
  }
}
```
(merge into the existing generated `app.json` rather than replacing it wholesale — keep the `icon`/`splash`/`ios`/`android` keys `create-expo-app` generated)

- [ ] **Step 5: Delete the default `App.tsx`** (Expo Router replaces it with file-based routing)

Run: `rm apps/app/App.tsx`

- [ ] **Step 6: Write `apps/app/app/_layout.tsx`**

```tsx
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 7: Write `apps/app/app/(tabs)/_layout.tsx`**

```tsx
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="map" options={{ title: "Map" }} />
      <Tabs.Screen name="log" options={{ title: "Log" }} />
      <Tabs.Screen name="lists" options={{ title: "Lists" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
```

- [ ] **Step 8: Write the five stub screens**

`apps/app/app/(tabs)/index.tsx`:
```tsx
import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Home — discovery feed (not yet built)</Text>
    </View>
  );
}
```

`apps/app/app/(tabs)/map.tsx`:
```tsx
import { View, Text } from "react-native";

export default function MapScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Map (not yet built)</Text>
    </View>
  );
}
```

`apps/app/app/(tabs)/log.tsx`:
```tsx
import { View, Text } from "react-native";

export default function LogScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Log a visit (not yet built)</Text>
    </View>
  );
}
```

`apps/app/app/(tabs)/lists.tsx`:
```tsx
import { View, Text } from "react-native";

export default function ListsScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Collections (not yet built)</Text>
    </View>
  );
}
```

`apps/app/app/(tabs)/profile.tsx`:
```tsx
import { View, Text } from "react-native";

export default function ProfileScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Profile (not yet built)</Text>
    </View>
  );
}
```

- [ ] **Step 9: Verify the web export builds** (proves the app, map, and web targets all compile from one codebase)

Run: `cd apps/app && npx expo export -p web`
Expected: `Exported: dist` with no errors

- [ ] **Step 10: Commit**

```bash
git add apps/app
git commit -m "Scaffold apps/app (Expo + Expo Router, iOS/Android/web)"
```

---

### Task 4: `packages/design-tokens` scaffold

**Files:**
- Create: `packages/design-tokens/package.json`
- Create: `packages/design-tokens/tsconfig.json`
- Create: `packages/design-tokens/src/index.ts`

- [ ] **Step 1: Write `packages/design-tokens/package.json`**

```json
{
  "name": "@coffeesnob/design-tokens",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./css/tokens.css": "./css/tokens.css"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Write `packages/design-tokens/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 3: Write a placeholder `packages/design-tokens/src/index.ts`** (real tokens land in Task 9)

```typescript
export const PLACEHOLDER = true;
```

- [ ] **Step 4: Verify it typechecks**

Run: `pnpm --filter @coffeesnob/design-tokens install && pnpm --filter @coffeesnob/design-tokens typecheck`
Expected: exits 0, no errors

- [ ] **Step 5: Commit**

```bash
git add packages/design-tokens
git commit -m "Scaffold packages/design-tokens"
```

---

### Task 5: `packages/supabase` scaffold

**Files:**
- Create: `packages/supabase/package.json`
- Create: `packages/supabase/tsconfig.json`
- Create: `packages/supabase/src/client.ts`
- Create: `packages/supabase/src/index.ts`

- [ ] **Step 1: Write `packages/supabase/package.json`**

```json
{
  "name": "@coffeesnob/supabase",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.47.10"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Write `packages/supabase/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 3: Write `packages/supabase/src/client.ts`**

```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createSupabaseClient(url: string, anonKey: string): SupabaseClient<Database> {
  if (!url || !anonKey) {
    throw new Error("createSupabaseClient: both url and anonKey are required");
  }
  return createClient<Database>(url, anonKey);
}
```

- [ ] **Step 4: Write a placeholder `packages/supabase/src/types.ts`** (replaced by generated types in Task 8)

```typescript
export type Database = Record<string, unknown>;
```

- [ ] **Step 5: Write `packages/supabase/src/index.ts`**

```typescript
export { createSupabaseClient } from "./client";
export type { Database } from "./types";
```

- [ ] **Step 6: Verify it typechecks**

Run: `pnpm --filter @coffeesnob/supabase install && pnpm --filter @coffeesnob/supabase typecheck`
Expected: exits 0

- [ ] **Step 7: Commit**

```bash
git add packages/supabase
git commit -m "Scaffold packages/supabase"
```

---

## Phase B — Supabase schema

> **Revised tooling (superseding the CLI/psql approach originally written below):** the Supabase MCP server is authenticated and connected directly in this session (project "Coffee SNOB", `project_id: kyiuhuivyugoqljqodil`, fresh/empty). Tasks 6–11 use its tools instead of the Supabase CLI + psql: `mcp__plugin_supabase_supabase__apply_migration` for DDL, `execute_sql` for seed/verification queries, `generate_typescript_types` for Task 11's types file, `get_project_url`/`get_publishable_keys` for client env vars. No CLI install, `supabase login`, project linking, or DB connection string is needed — the MCP server has already resolved project access. SQL is still saved to `supabase/migrations/*.sql` and `supabase/seed.sql` locally for version control, matching the original file structure below; only the *application* mechanism changed (MCP tool call instead of `supabase db push`/`psql -f`).
>
> The fetched anon/publishable key is not a secret (Supabase anon keys are meant to ship in client bundles; RLS is what protects data) — safe to write into gitignored `.env` files directly, no need to route it through the user.

### Task 6: Wire Supabase project credentials into both apps

**Files:**
- Create: `apps/web/.env.local` (gitignored — not committed)
- Create: `apps/app/.env` (gitignored — not committed)

- [ ] **Step 1: Fetch the project's URL and anon/publishable key**

Via MCP: `mcp__plugin_supabase_supabase__get_project_url` and `get_publishable_keys` with `project_id: kyiuhuivyugoqljqodil`.

- [ ] **Step 2: Write `apps/web/.env.local`**

```
NEXT_PUBLIC_SUPABASE_URL=https://kyiuhuivyugoqljqodil.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon key from Step 1>
```

- [ ] **Step 3: Write `apps/app/.env`**

```
EXPO_PUBLIC_SUPABASE_URL=https://kyiuhuivyugoqljqodil.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<the same anon key>
```

- [ ] **Step 4: Verify both are gitignored**

Run: `git check-ignore apps/web/.env.local apps/app/.env`
Expected: both paths printed (confirms they're ignored, matching the root `.gitignore`'s `.env*.local` / `.env` patterns — note `apps/app/.env` needs the literal `.env` pattern, not just `.env*.local`, since Expo's convention is a plain `.env` file)

- [ ] **Step 5: No commit of the env files themselves** (they're gitignored by design)

---

### Task 7: Migration — `cities` and `shops`

**Files:**
- Create: `supabase/migrations/<timestamp>_core.sql`

- [ ] **Step 1: Create the migration file locally** (for version control — this is written to disk but applied via MCP in Step 3, not `supabase db push`)

Create `supabase/migrations/0001_core.sql`

- [ ] **Step 2: Write the migration**

```sql
create table public.cities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  country text not null,
  region text not null,
  status text not null default 'coming_soon' check (status in ('live', 'coming_soon', 'demo')),
  created_at timestamptz not null default now()
);

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  name text not null,
  neighborhood text not null,
  lat double precision,
  lng double precision,
  price_tier text not null default '€€' check (price_tier in ('€', '€€', '€€€')),
  tag text,
  writeup text,
  order_note text,
  editorial_rating smallint check (editorial_rating between 1 and 5),
  created_at timestamptz not null default now()
);

alter table public.cities enable row level security;
alter table public.shops enable row level security;

-- Published content is public read-only. Writes go through the service-role
-- key (seed scripts, future editorial tooling) — there is no end-user write
-- path onto cities/shops, so no insert/update/delete policy is defined.
create policy "cities are publicly readable" on public.cities for select using (true);
create policy "shops are publicly readable" on public.shops for select using (true);
```

- [ ] **Step 3: Apply the migration via MCP**

Call `mcp__plugin_supabase_supabase__apply_migration` with `project_id: kyiuhuivyugoqljqodil`, `name: "core"`, `query: <the SQL from Step 2>`.
Expected: success response, no error.

- [ ] **Step 4: Verify the tables exist**

Call `mcp__plugin_supabase_supabase__list_tables` with `project_id: kyiuhuivyugoqljqodil`, `schemas: ["public"]`.
Expected: lists `cities` and `shops`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "Add cities and shops tables"
```

---

### Task 8: Migration — `lists` and `list_items`

**Files:**
- Create: `supabase/migrations/<timestamp>_lists.sql`

- [ ] **Step 1: Create the migration file locally**

Create `supabase/migrations/0002_lists.sql`

- [ ] **Step 2: Write the migration**

```sql
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('city_guide', 'collection')),
  slug text unique not null,
  title text not null,
  description text,
  body text,
  city_id uuid references public.cities(id) on delete cascade,
  curator_id uuid references auth.users(id) on delete set null,
  cover_photo_alt text,
  save_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint city_guide_has_city check (type <> 'city_guide' or city_id is not null)
);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  position integer not null,
  note text,
  unique (list_id, shop_id)
);

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

create policy "lists are publicly readable" on public.lists for select using (true);
create policy "list_items are publicly readable" on public.list_items for select using (true);
```

- [ ] **Step 3: Apply and verify via MCP**

Call `apply_migration` with `project_id: kyiuhuivyugoqljqodil`, `name: "lists"`, `query: <the SQL from Step 2>`.
Then call `list_tables` (verbose: true) and confirm `lists` and `list_items` appear with the expected columns, including the `city_guide_has_city` check constraint.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "Add lists and list_items tables"
```

---

### Task 9: Migration — `profiles`, `logs`, `list_saves`, `follows`

**Files:**
- Create: `supabase/migrations/<timestamp>_social.sql`

- [ ] **Step 1: Create the migration file locally**

Create `supabase/migrations/0003_social.sql`

- [ ] **Step 2: Write the migration**

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  taste_picks text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  note text,
  visited_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.list_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid not null references public.lists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, list_id)
);

create table public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint no_self_follow check (follower_id <> followee_id)
);

alter table public.profiles enable row level security;
alter table public.logs enable row level security;
alter table public.list_saves enable row level security;
alter table public.follows enable row level security;

create policy "profiles are publicly readable" on public.profiles for select using (true);
create policy "users insert their own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "users update their own profile" on public.profiles for update using (auth.uid() = id);

create policy "logs are publicly readable" on public.logs for select using (true);
create policy "users manage their own logs" on public.logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "saves are publicly readable" on public.list_saves for select using (true);
create policy "users manage their own saves" on public.list_saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "follow graph is publicly readable" on public.follows for select using (true);
create policy "users manage their own follows" on public.follows for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

-- Keep lists.save_count denormalized so the site/app can display it without a join+count.
create or replace function public.handle_list_save_change()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.lists set save_count = save_count + 1 where id = new.list_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.lists set save_count = greatest(save_count - 1, 0) where id = old.list_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger on_list_save_change
  after insert or delete on public.list_saves
  for each row execute function public.handle_list_save_change();

-- Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 3: Apply and verify via MCP**

Call `apply_migration` with `project_id: kyiuhuivyugoqljqodil`, `name: "social"`, `query: <the SQL from Step 2>`.
Then call `execute_sql` with `query: "select trigger_name from information_schema.triggers where event_object_table = 'users';"`.
Expected: includes `on_auth_user_created`

- [ ] **Step 4: Smoke-test the new-user trigger**

Call `execute_sql` with `query: "select count(*) from auth.users;"` (note the count), then call `execute_sql` with an insert-a-test-user flow is not available via SQL alone (auth.users requires the Auth API) — instead, skip creating a real test user and verify the trigger function's correctness by reading it back: call `execute_sql` with `query: "select prosrc from pg_proc where proname = 'handle_new_user';"` and confirm the returned function body matches Step 2's `handle_new_user` definition exactly (insert into profiles, coalesce username from raw_user_meta_data or email). This verifies the trigger is wired correctly without needing to fabricate a real signup.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "Add profiles, logs, list_saves, follows tables and auth triggers"
```

---

### Task 10: Seed data — launch cities + Lisbon demo content

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Write `supabase/seed.sql`**

```sql
-- Real launch markets (see CLAUDE.md: "Launch markets: Tampa, Portland,
-- Seattle, SF, NYC, Austin. US first, global eventually."). No shops yet —
-- nothing has cleared the two-visit curation bar in
-- coffee-snob-curation-standards.md, so these stay honestly empty.
insert into public.cities (slug, name, country, region, status) values
  ('tampa', 'Tampa', 'United States', 'North America', 'coming_soon'),
  ('portland', 'Portland', 'United States', 'North America', 'coming_soon'),
  ('seattle', 'Seattle', 'United States', 'North America', 'coming_soon'),
  ('san-francisco', 'San Francisco', 'United States', 'North America', 'coming_soon'),
  ('new-york', 'New York', 'United States', 'North America', 'coming_soon'),
  ('austin', 'Austin', 'United States', 'North America', 'coming_soon');

-- Demo content only. Lisbon is not a real launch market — this seeds one
-- fully-populated city (from the Claude Design project's example guide) so
-- the app and site have real-shaped data to render in local development.
-- Do not present this as published editorial content.
insert into public.cities (slug, name, country, region, status) values
  ('lisbon', 'Lisbon', 'Portugal', 'Europe', 'demo');

with lisbon as (select id from public.cities where slug = 'lisbon')
insert into public.shops (city_id, name, neighborhood, price_tier, tag, writeup, order_note, editorial_rating)
select lisbon.id, s.name, s.neighborhood, s.price_tier, s.tag, s.writeup, s.order_note, s.editorial_rating
from lisbon, (values
  ('Noi Coffee', 'Príncipe Real', '€€', 'Espresso bar',
   'The best-run bar in the country. Two grinders, one Ethiopian on filter, and a barista who will ask what you drank yesterday. Order at the counter and stay standing.',
   'Filter — whatever is newest', 5::smallint),
  ('Fábrica Coffee Roasters', 'Baixa', '€€', 'Roaster',
   'Roasts in the back, sells across the counter, and does not pretend the room is anything other than a workshop. The cortado is the control sample.',
   'Cortado, plus a bag of the Colombian', 4::smallint),
  ('Copenhagen Coffee Lab', 'Príncipe Real', '€€', 'Filter focus',
   'Nordic import that made light roast normal here. Bright, consistent, occasionally too full to sit. The pastry is better than it needs to be.',
   'V60, single origin', 4::smallint),
  ('Olisipo Roastery', 'Alcântara', '€€€', 'Roaster',
   'A working roastery with a cupping table open to the public on Fridays. Ask about the Brazilian naturals if the door is open.',
   'Whatever is on the cupping table', 4::smallint),
  ('Café Graça', 'Graça', '€', 'Neighbourhood',
   'Not a specialty room and not trying to be. Good beans, old tiles, three tables outside facing the wrong way for the view — which is the point.',
   'Espresso, one sugar, standing', 3::smallint),
  ('Tartine Baixa', 'Baixa', '€€', 'Bakery bar',
   'Coffee is a strong second act to the bread. Reroute if you are already walking past; do not plan a morning around it.',
   'Flat white and the sourdough', 3::smallint),
  ('Comoba', 'Cais do Sodré', '€€', 'All-day',
   'Pleasant, busy, and fine. The kitchen is the reason to come; the coffee follows the room rather than leading it.',
   'Breakfast, coffee incidental', 2::smallint)
) as s(name, neighborhood, price_tier, tag, writeup, order_note, editorial_rating);

with lisbon as (select id from public.cities where slug = 'lisbon')
insert into public.lists (type, slug, title, description, body, city_id, save_count)
select
  'city_guide',
  'lisbon',
  'Lisbon',
  'Eleven years of tiled cafés and a new generation that learned to roast light.',
  'Lisbon drinks more coffee per head than almost anywhere in Europe and, until recently, drank it badly on purpose — dark, cheap, and standing up. The habit survived; the beans changed. A handful of rooms opened in the last decade that roast light, weigh doses, and still sell an espresso for a euro twenty at the counter.

This guide covers seven shops we drank at more than once, across four neighbourhoods. The verdicts are ours, nobody paid to be here, and the ones we left out were left out on purpose.',
  lisbon.id,
  0
from lisbon;

with l as (select id from public.lists where slug = 'lisbon'),
     ordered as (
       select s.id, s.name,
         row_number() over (
           order by array_position(
             array['Noi Coffee','Fábrica Coffee Roasters','Copenhagen Coffee Lab','Olisipo Roastery','Café Graça','Tartine Baixa','Comoba'],
             s.name
           )
         ) as pos
       from public.shops s
       join public.cities c on c.id = s.city_id
       where c.slug = 'lisbon'
     )
insert into public.list_items (list_id, shop_id, position)
select l.id, ordered.id, ordered.pos from l, ordered;
```

- [ ] **Step 2: Run the seed against the project via MCP**

Call `mcp__plugin_supabase_supabase__execute_sql` with `project_id: kyiuhuivyugoqljqodil`, `query: <the full contents of supabase/seed.sql>`.
Expected: no error.

- [ ] **Step 3: Verify**

Call `execute_sql` with `query: "select slug, status from public.cities order by slug;"`.
Expected: 6 `coming_soon` rows + `lisbon` as `demo`

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.sql
git commit -m "Seed launch cities and Lisbon demo city guide"
```

---

### Task 11: Generate Supabase TypeScript types + query helpers

**Files:**
- Modify: `packages/supabase/src/types.ts` (replace placeholder)
- Create: `packages/supabase/src/queries.ts`
- Modify: `packages/supabase/src/index.ts`
- Create: `packages/supabase/test/queries.test.ts`

- [ ] **Step 1: Generate types from the project via MCP**

Call `mcp__plugin_supabase_supabase__generate_typescript_types` with `project_id: kyiuhuivyugoqljqodil`. Write the returned TypeScript directly to `packages/supabase/src/types.ts` (overwriting the placeholder), unmodified.
Expected: file now contains a large `Database` type covering all tables from Tasks 7–9

- [ ] **Step 2: Write `packages/supabase/src/queries.ts`**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

type Client = SupabaseClient<Database>;

export async function getCities(client: Client) {
  const { data, error } = await client
    .from("cities")
    .select("id, slug, name, country, region, status")
    .order("name");
  if (error) throw error;
  return data;
}

export async function getCityGuide(client: Client, citySlug: string) {
  const { data: city, error: cityError } = await client
    .from("cities")
    .select("id, slug, name, country, region, status")
    .eq("slug", citySlug)
    .single();
  if (cityError) throw cityError;

  const { data: guide, error: guideError } = await client
    .from("lists")
    .select(
      "id, slug, title, description, body, cover_photo_alt, save_count, list_items(position, note, shops(id, name, neighborhood, price_tier, tag, writeup, order_note, editorial_rating))"
    )
    .eq("type", "city_guide")
    .eq("city_id", city.id)
    .single();
  if (guideError) throw guideError;

  return { city, guide };
}
```

- [ ] **Step 3: Update `packages/supabase/src/index.ts`**

```typescript
export { createSupabaseClient } from "./client";
export { getCities, getCityGuide } from "./queries";
export type { Database } from "./types";
```

- [ ] **Step 4: Write a failing test first — `packages/supabase/test/queries.test.ts`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { getCities } from "../src/queries";

function fakeClient(rows: unknown[]) {
  return {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: rows, error: null }),
      }),
    }),
  } as any;
}

describe("getCities", () => {
  it("returns the rows the client resolves with", async () => {
    const client = fakeClient([{ slug: "lisbon", name: "Lisbon" }]);
    const cities = await getCities(client);
    expect(cities).toEqual([{ slug: "lisbon", name: "Lisbon" }]);
  });

  it("throws when the client returns an error", async () => {
    const client = {
      from: () => ({
        select: () => ({
          order: () => Promise.resolve({ data: null, error: new Error("boom") }),
        }),
      }),
    } as any;
    await expect(getCities(client)).rejects.toThrow("boom");
  });
});
```

- [ ] **Step 5: Run the test to verify it fails first if `queries.ts` doesn't exist yet, then passes**

Run: `pnpm --filter @coffeesnob/supabase test`
Expected: both tests pass (2 passed)

- [ ] **Step 6: Commit**

```bash
git add packages/supabase
git commit -m "Generate Supabase types and add typed query helpers"
```

---

## Phase C — Design tokens

### Task 12: Port colors, type scale, and fonts

**Files:**
- Modify: `packages/design-tokens/src/index.ts` (replace placeholder)
- Create: `packages/design-tokens/src/colors.ts`
- Create: `packages/design-tokens/css/tokens.css`
- Create: `packages/design-tokens/test/colors.test.ts`
- Create: `apps/web/public/fonts/area-normal/` (4 `.otf` files)

- [ ] **Step 1: Write `packages/design-tokens/src/colors.ts`** (ported from the design project's `styles.css` `:root` block — see `docs/superpowers/specs/2026-08-21-project-setup-design.md`)

```typescript
export const colors = {
  sage: "#9cb6b8",
  sageDk: "#86a4a6",
  sageLt: "#b6c9ca",
  oxblood: "#4a1206",
  oxbloodLt: "#63200e",
  burnt: "#c46a17",
  teal: "#0e8ba3",
  tealDk: "#0a6272",
  cream: "#e9e4d0",
  paper: "#f0ecdf",
  paper2: "#e6e1d1",
  card: "#faf8ef",
  ink: "#161310",
  ink2: "#4b423a",
  ink3: "#8c8175",
  rule: "rgba(22,19,16,.13)",
  rule2: "rgba(22,19,16,.07)",
} as const;

export type ColorToken = keyof typeof colors;
```

- [ ] **Step 2: Write a failing test first — `packages/design-tokens/test/colors.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { colors } from "../src/colors";

const REQUIRED_KEYS = [
  "sage", "sageDk", "sageLt", "oxblood", "oxbloodLt", "burnt",
  "teal", "tealDk", "cream", "paper", "paper2", "card", "ink", "ink2", "ink3",
] as const;

describe("colors", () => {
  it("defines every required brand color", () => {
    for (const key of REQUIRED_KEYS) {
      expect(colors[key]).toBeDefined();
    }
  });

  it("defines solid colors as 6-digit hex", () => {
    const solidKeys = REQUIRED_KEYS.filter((k) => k !== "rule");
    for (const key of solidKeys) {
      expect(colors[key]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
```

- [ ] **Step 3: Run the test**

Run: `pnpm --filter @coffeesnob/design-tokens test`
Expected: 2 passed

- [ ] **Step 4: Write `packages/design-tokens/css/tokens.css`** (the CSS-variable mirror of `colors.ts` — these are static brand constants kept in sync by hand, not generated, since they change rarely)

```css
@font-face{font-family:'Area';src:url('/fonts/area-normal/fonnts.com-Area_Normal_Regular.otf') format('opentype');font-weight:400;font-display:swap}
@font-face{font-family:'Area';src:url('/fonts/area-normal/fonnts.com-Area_Normal_Bold.otf') format('opentype');font-weight:600 900;font-display:swap}
@font-face{font-family:'Area Extended';src:url('/fonts/area-normal/fonnts.com-Area_Extended_Bold.otf') format('opentype');font-weight:700;font-display:swap}
@font-face{font-family:'Area Extended';src:url('/fonts/area-normal/fonnts.com-Area_Extended_Black.otf') format('opentype');font-weight:900;font-display:swap}

:root{
  --sage:      #9cb6b8;
  --sage-dk:   #86a4a6;
  --sage-lt:   #b6c9ca;
  --oxblood:   #4a1206;
  --oxblood-lt:#63200e;
  --burnt:     #c46a17;
  --teal:      #0e8ba3;
  --teal-dk:   #0a6272;
  --cream:     #e9e4d0;
  --paper:     #f0ecdf;
  --paper-2:   #e6e1d1;
  --card:      #faf8ef;
  --ink:       #161310;
  --ink-2:     #4b423a;
  --ink-3:     #8c8175;
  --rule:      rgba(22,19,16,.13);
  --rule-2:    rgba(22,19,16,.07);
  --r-sm: 4px; --r-md: 8px; --r-lg: 14px;
}
```

- [ ] **Step 5: Update `packages/design-tokens/src/index.ts`**

```typescript
export { colors } from "./colors";
export type { ColorToken } from "./colors";
```

- [ ] **Step 6: Fetch the 4 Area font files from the Claude Design project and write them to `apps/web/public/fonts/area-normal/`**

Using the `DesignSync` tool (`get_file`, projectId `019df027-97af-74d2-a376-2a823fc1ddc5`) fetch each of:
- `public/fonts/area-normal/fonnts.com-Area_Extended_Black.otf`
- `public/fonts/area-normal/fonnts.com-Area_Extended_Bold.otf`
- `public/fonts/area-normal/fonnts.com-Area_Normal_Bold.otf`
- `public/fonts/area-normal/fonnts.com-Area_Normal_Regular.otf`

Each `get_file` response is base64 for binary files (`isBase64: true`) — decode and write to the identical relative path under `apps/web/public/fonts/area-normal/`.

- [ ] **Step 7: Verify the fonts landed**

Run: `ls apps/web/public/fonts/area-normal/`
Expected: all 4 `.otf` files present

- [ ] **Step 8: Commit**

```bash
git add packages/design-tokens apps/web/public/fonts
git commit -m "Port brand colors, type tokens, and Area typeface"
```

---

## Phase D — Marketing site

### Task 13: Global styles and shared primitives

**Files:**
- Modify: `apps/web/app/globals.css`
- Create: `apps/web/components/primitives.tsx`

- [ ] **Step 1: Replace `apps/web/app/globals.css`** with the ported `styles.css` (app-shared base) + `web.css` (web-specific chrome) from the design project, importing tokens from `packages/design-tokens` instead of redefining `:root`

```css
@import "@coffeesnob/design-tokens/css/tokens.css";

*{box-sizing:border-box}
html,body{margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--paper);font-family:'Area',-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased}

.snob-web{color:var(--ink);letter-spacing:-.01em;overflow-x:hidden}
.wrap{max-width:1280px;margin:0 auto;padding:0 56px}
.hair{flex:1;height:1px;background:var(--rule)}

.d1{font-weight:700;font-size:40px;line-height:.92;letter-spacing:-.035em;margin:0}
.d2{font-weight:700;font-size:30px;line-height:.94;letter-spacing:-.032em;margin:0}
.d3{font-weight:700;font-size:22px;line-height:1;letter-spacing:-.028em;margin:0}
.d4{font-weight:700;font-size:17px;line-height:1.05;letter-spacing:-.024em;margin:0}
.body{font-weight:400;font-size:13.5px;line-height:1.45;letter-spacing:-.008em}
.body-sm{font-weight:400;font-size:12px;line-height:1.4;letter-spacing:-.005em}
.snob-web .body{color:var(--ink-2);text-wrap:pretty;margin:0}

.ext{font-family:'Area Extended','Area',sans-serif;font-weight:900;text-transform:uppercase}
.label{font-family:'Area Extended','Area',sans-serif;font-weight:700;text-transform:uppercase;font-size:8.5px;letter-spacing:.14em;line-height:1}
.label-lg{font-family:'Area Extended','Area',sans-serif;font-weight:900;text-transform:uppercase;font-size:11px;letter-spacing:.1em;line-height:1}
.num{font-family:'Area Extended','Area',sans-serif;font-weight:900;letter-spacing:-.02em;font-variant-numeric:tabular-nums}

.h1{font-weight:700;font-size:clamp(52px,7vw,112px);line-height:.87;letter-spacing:-.045em;margin:0}
.h1 em{font-style:normal;color:var(--burnt)}
.h2{font-weight:700;font-size:clamp(34px,3.6vw,54px);line-height:.95;letter-spacing:-.038em;margin:18px 0 0}
.h2.ox{color:var(--oxblood)}
.h3{font-weight:700;font-size:clamp(24px,2vw,30px);line-height:1;letter-spacing:-.03em;margin:0}
.lede{font-weight:400;font-size:17.5px;line-height:1.5;letter-spacing:-.012em;color:var(--ink-2);margin:0;text-wrap:pretty}
.lede.on-dark{color:rgba(233,228,208,.72)}
.fine{font-size:11.5px;line-height:1.5;color:var(--ink-3);margin:14px 0 0;letter-spacing:-.005em}
.fine.ox-fine{color:rgba(74,18,6,.6)}

.chip{display:inline-flex;align-items:center;gap:5px;height:27px;padding:0 11px;border-radius:2px;border:1px solid var(--rule);background:transparent;color:var(--ink-2);white-space:nowrap;font-family:'Area Extended','Area',sans-serif;font-weight:700;text-transform:uppercase;font-size:8.5px;letter-spacing:.1em}
.chip.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.chip.ox{background:var(--oxblood);color:var(--cream);border-color:var(--oxblood)}
.chip.bu{background:var(--burnt);color:var(--ink);border-color:var(--burnt)}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:46px;padding:0 18px;border-radius:2px;border:none;cursor:pointer;font-family:'Area Extended','Area',sans-serif;font-weight:900;text-transform:uppercase;font-size:10.5px;letter-spacing:.1em}
.btn-ox{background:var(--oxblood);color:var(--cream)}
.btn-bu{background:var(--burnt);color:var(--ink)}
.btn-line{background:transparent;color:var(--ink);border:1px solid var(--ink)}

a{color:var(--teal-dk);text-decoration:none}
a:hover{color:var(--burnt)}

.detour{display:inline-flex;gap:2px;align-items:center}

.photo-ph{background:var(--sage-dk);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.photo-ph::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.07) 0 6px,transparent 6px 12px)}
.photo-ph::before{content:attr(data-label);font-family:'Area Extended','Area',sans-serif;font-weight:700;text-transform:uppercase;font-size:9.5px;max-width:16em;letter-spacing:.12em;color:rgba(255,255,255,.78);text-align:center;padding:6px;position:relative;z-index:1}
.photo-ph.ox{background:var(--oxblood)}
.photo-ph.ox::before{color:rgba(233,228,208,.55)}
.photo-ph.cr{background:var(--paper-2)}
.photo-ph.cr::before{color:rgba(22,19,16,.45)}

/* ── Nav ── */
.nav{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:40px;padding:18px 56px;background:rgba(240,236,223,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--rule)}
.nav-logo{display:block;flex-shrink:0}
.nav-links{display:flex;gap:26px;flex:1}
.nav-links a,.nav-sign{font-family:'Area Extended','Area',sans-serif;font-weight:700;text-transform:uppercase;font-size:9.5px;letter-spacing:.13em;color:var(--ink-2)}
.nav-links a:hover,.nav-sign:hover{color:var(--burnt)}
.nav-links a.on{color:var(--ink);position:relative}
.nav-links a.on::after{content:'';position:absolute;left:0;right:0;bottom:-6px;height:2px;background:var(--burnt)}
.nav-right{display:flex;align-items:center;gap:22px}
.btn.nav-cta{height:38px;font-size:9.5px}

/* ── Signup ── */
.signup{display:flex;gap:8px;max-width:470px}
.signup input{flex:1;height:52px;padding:0 16px;border:1px solid var(--ink);border-radius:2px;background:transparent;font-family:'Area',sans-serif;font-size:15px;letter-spacing:-.01em;color:var(--ink)}
.signup input::placeholder{color:var(--ink-3)}
.signup input:focus{outline:2px solid var(--burnt);outline-offset:-1px}
.signup .btn{height:52px;flex-shrink:0}
.signup.on-dark input{border-color:rgba(240,236,223,.45);color:var(--paper)}
.signup.on-dark input::placeholder{color:rgba(240,236,223,.5)}
.signed{border-left:2px solid var(--burnt);padding-left:16px}
.signed .label-lg{color:var(--burnt)}
.signed .body{margin:8px 0 0;color:var(--ink-2)}
.signed.on-dark .body{color:rgba(240,236,223,.7)}

/* ── Section heads ── */
.sec-head{padding-bottom:52px}
.sec-head-row{display:flex;align-items:flex-end;justify-content:space-between;gap:40px}
.seeall{color:var(--oxblood);flex-shrink:0;padding-bottom:6px}
.seeall:hover{color:var(--burnt)}
.rescount{color:var(--ink-3);flex-shrink:0}

/* ── City band / hero (landing) ── */
.hero{display:grid;grid-template-columns:1.18fr .82fr;gap:56px;align-items:stretch;padding:0 0 0 56px;border-bottom:1px solid var(--rule)}
.hero-type{padding:76px 0 72px;display:flex;flex-direction:column;max-width:760px}
.hero-eyebrow{display:flex;align-items:center;gap:16px;color:var(--ink-3);margin-bottom:46px}
.hero-sub{display:grid;grid-template-columns:minmax(0,1fr);gap:26px;margin-top:auto;padding-top:52px;max-width:520px}
.hero-art{position:relative;min-height:660px}
.hero-art .photo-ph{position:absolute;inset:0}
.hero-art-tag{position:absolute;left:26px;bottom:26px;z-index:2}

.cityband{background:var(--sage);border-bottom:1px solid rgba(74,18,6,.14)}
.cityband-in{max-width:1280px;margin:0 auto;padding:22px 56px;display:flex;align-items:center;gap:28px}
.citylist{display:flex;flex-wrap:wrap;gap:6px 26px;list-style:none;margin:0;padding:0}
.citylist li{color:var(--oxblood)}
.citylist a{color:var(--oxblood)}
.citylist a:hover{color:var(--burnt)}
.citylist li.more,.citylist li.more a{color:rgba(74,18,6,.5)}

/* ── Page head (city guides / journal index) ── */
.pagehead{padding:64px 0 48px}
.pagehead-in{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:end}

/* ── City guides grid ── */
.ggrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:28px}
.gcard{display:block;color:var(--ink)}
.gphoto{aspect-ratio:4/3;border-radius:2px}
.gline{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 12px;margin-top:16px;padding-top:14px;border-top:1px solid var(--rule)}
.gcountry{color:var(--ink-3);flex-shrink:0}
.gmeta{display:flex;flex-direction:column;gap:4px;margin-top:12px;color:var(--ink-2)}
.gmeta .num{font-size:12.5px;margin-right:3px}
.gmeta .gbu{color:var(--burnt)}
.gcard:hover{color:var(--ink)}
.gcard:hover .gline{border-color:var(--burnt)}

.cgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:28px}
.ccard,.ccard.live{position:relative;color:var(--ink)}
.ccard .ccard-photo,.ccard-photo{aspect-ratio:4/3;border-radius:2px}
.ccard-line{display:flex;justify-content:space-between;align-items:baseline;margin-top:14px}
.ccard-country{color:var(--ink-3)}
.ccard-meta{display:flex;flex-direction:column;gap:4px;margin-top:8px;color:var(--ink-2)}
.ccard-meta .bu{color:var(--burnt)}
.ccard-go{display:block;margin-top:10px;color:var(--oxblood)}
.ccard-go.soon{color:var(--ink-3)}
.ccard.live:hover .ccard-go{color:var(--burnt)}

.searchfield{display:flex;align-items:center;gap:9px;height:44px;padding:0 14px;border:1px solid var(--ink);border-radius:2px}
.searchfield input{flex:1;border:none;background:transparent;font-family:'Area',sans-serif;font-size:14px;outline:none}
.filterbar{border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:20px 0}
.filter-in{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.regionchips{display:flex;gap:6px;flex-wrap:wrap}
.sortsel select{font-family:'Area',sans-serif;font-size:13px;border:1px solid var(--rule);border-radius:2px;padding:8px 10px}

/* ── Journal ── */
.jgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:36px}
.jcard{border-top:1px solid var(--rule);padding-top:20px}
.jphoto{aspect-ratio:4/3;margin-bottom:22px;border-radius:2px}
.jkicker{color:var(--burnt);display:block;margin-bottom:12px}
.jcard .d3{margin-bottom:10px;max-width:22ch}

.byline{display:flex;align-items:center;gap:10px;min-width:0}
.bl-name{color:var(--ink)}
.bl-meta{color:var(--ink-3)}
.bl-dot{width:3px;height:3px;background:var(--rule);flex-shrink:0}

.pgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:56px 28px}
.pcard{display:flex;flex-direction:column;border-top:1px solid var(--rule);padding-top:18px}
.pcard-link{display:block;color:var(--ink);flex:1}
.pcard-photo{aspect-ratio:3/2;border-radius:2px}
.pcard-kicker{display:block;color:var(--burnt);margin:20px 0 12px}
.pcard-title{max-width:20ch;text-wrap:pretty}
.pcard .pcard-dek{margin-top:16px;color:var(--ink-2);max-width:40ch}
.pcard-foot{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-top:22px;padding-top:12px;border-top:1px solid var(--rule)}
.pcard-author{color:var(--ink-2)}
.pcard-meta{color:var(--ink-3);text-align:right}
.pcard:hover{border-color:var(--burnt)}
.pcard:hover .pcard-title{color:var(--burnt)}

/* ── Journal post ── */
.posthead{padding:56px 0 0}
.posthead-in{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
.ph-photo{aspect-ratio:16/8;margin:40px 0 12px}
.ph-foot{display:flex;justify-content:space-between;align-items:center;margin-top:8px}
.post{padding:48px 0 96px}
.post-in{display:grid;grid-template-columns:220px 1fr;gap:64px;max-width:900px;margin:0 auto}
.post-col{max-width:640px;font-size:16px;line-height:1.6;color:var(--ink-2)}
.post-col p{margin:0 0 22px}
.post-h2{font-weight:700;font-size:26px;letter-spacing:-.03em;color:var(--ink);margin:44px 0 18px}
.pullq{border-left:2px solid var(--burnt);padding-left:20px;margin:36px 0}
.pullq p{font-weight:700;font-size:20px;line-height:1.3;color:var(--ink);letter-spacing:-.02em}
.post-fig{margin:36px 0}
.post-fig .photo-ph{aspect-ratio:3/2;border-radius:2px}
.shopnote{border:1px solid var(--rule);padding:20px;margin:36px 0}
.shopnote-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.post-tags{display:flex;align-items:center;gap:10px;margin-top:40px}
.post-rail{position:sticky;top:100px;align-self:start;display:flex;flex-direction:column;gap:32px}
.rail-author{display:flex;gap:12px;margin-top:10px}
.rail-toc{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:8px}

/* ── Letter band ── */
.letter{background:var(--burnt);padding:96px 0 100px}
.letter-in{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:end}
.letter-h{color:var(--ink)}
.letter .lede{color:rgba(22,19,16,.78);max-width:440px}
.letter-form{display:grid;gap:26px}
.letter-form .signup input{border-color:rgba(22,19,16,.55);color:var(--ink)}
.letter-form .signup input::placeholder{color:rgba(22,19,16,.5)}
.letter-form .signup .btn{background:var(--oxblood);color:var(--cream)}
.letter-meta{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px 24px}
.letter-meta li{color:rgba(22,19,16,.62);display:flex;align-items:center;gap:7px}
.letter-meta li::before{content:'';width:4px;height:4px;background:var(--oxblood)}
.letter .signed .label-lg{color:var(--oxblood)}
.letter .signed{border-color:var(--oxblood)}
.letter .signed .body{color:rgba(22,19,16,.72)}

/* ── Footer ── */
.foot{background:var(--oxblood);color:var(--cream);padding:80px 0 26px}
.foot-in{display:grid;grid-template-columns:1.4fr repeat(4,1fr);gap:40px}
.foot-brand .body-sm{color:rgba(233,228,208,.55);margin:18px 0 0;max-width:24ch}
.foot-col .label{color:rgba(233,228,208,.45);display:block;margin-bottom:18px}
.foot-col ul{list-style:none;margin:0;padding:0;display:grid;gap:11px}
.foot-col a{font-size:13.5px;color:var(--cream);letter-spacing:-.008em}
.foot-col a:hover{color:var(--burnt)}
.foot-base{display:flex;justify-content:space-between;margin-top:72px;padding-top:22px;border-top:1px solid rgba(233,228,208,.18);color:rgba(233,228,208,.45)}
.foot-legal{display:flex;gap:24px}
.foot-legal a{color:rgba(233,228,208,.45)}
.foot-legal a:hover{color:var(--burnt)}

@media(max-width:900px){
  .wrap,.nav,.cityband-in{padding-left:40px;padding-right:40px}
  .hero{grid-template-columns:1fr;padding:0}
  .hero-type{padding:56px 40px 48px}
  .hero-art{min-height:340px}
  .nav-links{display:none}
  .pagehead-in{grid-template-columns:1fr}
  .ggrid,.cgrid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .jgrid{grid-template-columns:1fr;gap:44px}
  .pgrid{grid-template-columns:1fr;gap:48px}
  .letter-in,.post-in{grid-template-columns:1fr}
  .foot-in{grid-template-columns:repeat(2,1fr)}
}
```

- [ ] **Step 2: Write `apps/web/components/primitives.tsx`** (ported from the design project's `_primitives.jsx` / `web-chrome.jsx` — web-only subset needed by the marketing pages)

```tsx
const SCRIPT_PATHS = [
  "M225.65,137.69c-18.03,0-37.26,23.32-43.75,49.06-.1.4-.32.75-.63,1.01-.45.39-.92,1.02-1.52,1.97-11.81,23.28-17.79,29.76-21.78,29.59-3.66-.16-3.33-4.49-.33-11.97,10.31-25.11,21.28-47.22,21.28-59.19,0-6.32-3.33-10.31-9.64-10.31-8.98,0-19.62,8.81-35.08,35.75-1,1.83-2.16,2.33-2.83,2.33s-1.33-.66-.33-3.16l5.32-13.63c2.33-5.99,3.99-9.81,3.99-13.3.17-4.16-1.16-7.65-7.65-7.81-9.41-.31-20.39,17.69-29.23,35.7-.74,1.51-2.92,1.52-3.65,0-3.6-7.54-9.25-14.32-15.03-19.9-8.81-8.81-17.79-19.95-17.79-31.09s10.97-27.93,27.1-27.93c21.11,0,24.44,7.65,18.95,38.74-.17,1.5.17,2.33,1,2.33s1.5-1,2-2.49c1.66-6.32,4.16-24.44,8.65-38.9.33-1.33,0-2-.83-2-1.5,0-4.49.83-7.81.83-5.82,0-9.81-1.5-19.62-1.5-21.61,0-38.41,18.12-38.41,36.41,0,12.64,9.14,24.94,18.62,34.08,9.14,8.81,17.79,20.95,17.79,32.92,0,15.63-12.14,31.92-30.76,31.92s-23.77-8.15-23.77-27.27c0-4.49.33-9.64.66-15.63.17-1-.5-1.33-1.16-1.33s-1.33.5-1.66,1.33c-2,7.65-2.16,30.09-6.15,43.23-.67,1.5-.17,2,.66,2,1.66,0,4.66-.83,8.81-.83,4.82,0,11.97,1.5,18.45,1.5,25.77,0,44.22-17.46,44.22-40.4,0-2.77-.38-5.48-1.04-8.13-.17-.68.05-1.37.52-1.89.38-.42.76-1.05,1.22-1.95,11.3-23.44,18.45-30.09,22.45-29.93,3.66,0,3.49,4.49.66,11.97l-19.29,55.03c-3.82,11.31-1.66,14.8,3.16,14.8,3.99,0,7.48-2,8.48-5.32,1-3.49-1.16-9.48,2.99-22.28,11.97-34.75,32.75-56.53,41.73-56.53,2.66,0,3.99,2,3.99,6.15,0,8.65-11.31,32.42-20.62,55.86-2.16,5.98-3.33,10.14-3.49,13.47-.16,4.16.83,7.81,7.48,8.15,7.74.38,16.05-11.62,23.77-25.75,1.02-1.87,3.85-1.15,3.85.97h0c0,15.46,6.98,25.27,19.29,25.27,22.28,0,46.39-34.58,46.39-66.01,0-15.46-7.32-25.94-19.62-25.94ZM201.87,225.15c-8.81,0-11.97-8.65-11.97-20.12,0-27.93,17.62-62.85,32.75-62.85,8.81,0,12.14,9.14,12.14,20.62,0,28.1-17.79,62.35-32.92,62.35Z",
  "M292.99,137.86c-10.31,0-22.11,16.79-31.92,34.75-1.16,2-1.83,2.33-2.66,2.33s-1.16-1-.5-2.83l12.64-32.75c4.49-11.8,11.14-31.42,17.29-47.05.83-2.16.83-2.83-.83-2.83-1.83,0-3.82,1.33-6.32,2.49-4.99,2.83-17.12,3.49-21.28,3.49-1.83,0-2.83.33-2.83,1.5,0,1,.83,1.16,2.16,1.16,2.33,0,4.32-.17,7.98-.17,7.32,0,6.48,4.32,4.16,11.31l-31.59,94.6c-3.82,11.14-7.81,16.96-7.81,19.12,0,2.83,15.63,6.65,25.44,6.65,28.43,0,48.05-42.9,48.05-71.82,0-11.64-3.33-19.95-11.97-19.95ZM257.91,226.14c-7.15,0-14.3-5.32-12.3-10.97l7.32-20.78c6.65-19.62,24.61-47.72,35.75-47.72,4.82,0,6.32,4.82,6.32,13.3,0,25.77-15.3,66.17-37.08,66.17Z",
];

export function Script({ height = 26, color = "var(--teal)" }: { height?: number; color?: string }) {
  return (
    <svg height={height} width={height * (288 / 178)} viewBox="22 82 288 178" fill={color} style={{ display: "block" }} role="img" aria-label="Snob">
      {SCRIPT_PATHS.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

export function Eyebrow({
  children, color = "var(--ink-3)", rule = true, style = {},
}: { children: React.ReactNode; color?: string; rule?: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, ...style }}>
      <span className="label" style={{ color, flexShrink: 0 }}>{children}</span>
      {rule && <span style={{ flex: 1, height: 1, background: "var(--rule)" }} />}
    </div>
  );
}

const DETOUR = ["Stay home", "If it's on your way", "Worth the detour", "Make the trip", "Catch a flight"];
const DETOUR_SHORT = ["Stay home", "On your way", "Worth the detour", "Make the trip", "Catch a flight"];
const DETOUR_SUB = [
  "Skip it. Your coffee at home is probably better.",
  "Nothing wrong with it — just don't go out of your way.",
  "A solid find. If you're in the city, reroute for this one.",
  "Genuinely exceptional. Worth going out of your way for, no excuses needed.",
  "A once-in-a-while experience. You'd plan a trip around this place — or already have.",
];

export function Detour({ value = 4, short = false }: { value?: number; short?: boolean }) {
  const v = Math.max(1, Math.min(5, Math.round(value)));
  const fill = v === 4 ? "bu" : v === 5 ? "ox" : "";
  return (
    <span className={["chip", fill].filter(Boolean).join(" ")}>
      <span className="detour" style={{ gap: 1.5 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} width="5.5" height="7" viewBox="0 0 9 11" fill="none" stroke="var(--burnt)"
            strokeOpacity={i <= v ? 1 : 0.32} strokeWidth="2.6" style={{ display: "block" }}>
            <path d="M1.5 1.5 6 5.5l-4.5 4" />
          </svg>
        ))}
      </span>
      {(short ? DETOUR_SHORT : DETOUR)[v - 1]}
    </span>
  );
}

export { DETOUR, DETOUR_SHORT, DETOUR_SUB };

export function Avatar({ name = "AB", size = 28, bg = "var(--sage-dk)", fg = "var(--paper)" }: { name?: string; size?: number; bg?: string; fg?: string }) {
  const init = name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg, color: fg, display: "flex",
      alignItems: "center", justifyContent: "center", flexShrink: 0,
      fontFamily: "'Area Extended','Area',sans-serif", fontWeight: 900, fontSize: size * 0.34, letterSpacing: "-.01em",
    }}>{init}</div>
  );
}

export function SearchIcon({ size = 17, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="square">
      <circle cx="10.5" cy="10.5" r="6.5" /><path d="m19.5 19.5-4-4" />
    </svg>
  );
}
```

- [ ] **Step 3: Verify the app still builds with the new global styles**

Run: `pnpm --filter web build`
Expected: `Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/globals.css apps/web/components/primitives.tsx
git commit -m "Port global styles and shared web primitives"
```

---

### Task 14: Shared web chrome (Nav, Footer, Signup, Letter band)

> **Post-review split:** code quality review found putting the interactive `SignupForm` in the same `"use client"` file as `WebNav`/`WebFooter` force-hydrates the nav and footer on every page for no reason (they have no state). Fixed by splitting `SignupForm` into its own `apps/web/components/signup-form.tsx` (the only file with `"use client"`); `web-chrome.tsx` stays a plain Server Component module that imports `SignupForm` for `LetterBand`. Any later task importing `SignupForm` directly (rather than via `LetterBand`) should import it from `@/components/signup-form`, not `@/components/web-chrome`.

**Files:**
- Create: `apps/web/components/web-chrome.tsx`
- Create: `apps/web/components/signup-form.tsx`

- [ ] **Step 1: Write `apps/web/components/web-chrome.tsx`** (ported from the design project's `web-chrome.jsx`; `SignupForm` itself lives in `signup-form.tsx`, imported here for `LetterBand`)

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Script, Eyebrow } from "./primitives";

const NAV_ITEMS: [string, string][] = [
  ["City guides", "/city-guides"],
  ["Journal", "/journal"],
  ["Shop", "#"],
  ["The app", "#"],
  ["About", "#"],
];

export function WebNav({ active }: { active?: string }) {
  return (
    <header className="nav">
      <Link href="/" className="nav-logo"><Script height={30} /></Link>
      <nav className="nav-links">
        {NAV_ITEMS.map(([label, href]) => (
          <Link key={label} href={href} className={active === label ? "on" : undefined}>{label}</Link>
        ))}
      </nav>
      <div className="nav-right">
        <a href="#" className="nav-sign">Sign in</a>
        <a href="#letter" className="btn btn-bu nav-cta">Get the letter</a>
      </div>
    </header>
  );
}

export function SignupForm({
  dark = false, placeholder = "you@email.com", cta = "Get the letter", done,
}: { dark?: boolean; placeholder?: string; cta?: string; done?: [string, string] }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className={`signed ${dark ? "on-dark" : ""}`}>
        <span className="label-lg">{done ? done[0] : "You're on the list"}</span>
        <p className="body">{done ? done[1] : "First letter lands Sunday. Nothing else until then."}</p>
      </div>
    );
  }

  return (
    <form className={`signup ${dark ? "on-dark" : ""}`} onSubmit={(e) => { e.preventDefault(); if (email.trim()) setSent(true); }}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={placeholder} aria-label="Email address" />
      <button type="submit" className="btn btn-bu">{cta}</button>
    </form>
  );
}

export function LetterBand() {
  return (
    <section className="letter" id="letter">
      <div className="wrap letter-in">
        <div>
          <Eyebrow color="rgba(240,236,223,.55)">The Sunday letter</Eyebrow>
          <h2 className="h2 letter-h">One shop.<br />One roaster.<br />Nothing else.</h2>
        </div>
        <div className="letter-form">
          <p className="lede">Sent every Sunday morning. A shop worth the detour, the roaster behind the bar, and where we are opening the map next.</p>
          <SignupForm dark />
          <ul className="letter-meta">
            <li className="body-sm">Free, and it stays free</li>
            <li className="body-sm">No sponsored placements</li>
            <li className="body-sm">Early access when the app ships</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function WebFooter() {
  const cols: [string, [string, string][]][] = [
    ["Discover", [["City guides", "/city-guides"], ["The map", "#"], ["Collections", "#"], ["Submit a shop", "#"]]],
    ["Read", [["Journal", "/journal"], ["Roaster interviews", "/journal"], ["Brewing", "/journal"], ["The year in coffee", "#"]]],
    ["Shop", [["Snob merch", "#"], ["Gear we use", "#"], ["Bean subscription", "#"], ["Gift the letter", "#"]]],
    ["Snob", [["About", "#"], ["The detour scale", "#"], ["The app", "#"], ["Press", "#"], ["Contact", "#"]]],
  ];
  return (
    <footer className="foot">
      <div className="wrap foot-in">
        <div className="foot-brand">
          <Script height={34} color="var(--cream)" />
          <p className="body-sm">A specialty coffee locator. In build, from wherever the coffee is good.</p>
        </div>
        {cols.map(([heading, links]) => (
          <div key={heading} className="foot-col">
            <span className="label">{heading}</span>
            <ul>{links.map(([label, href]) => <li key={label}><Link href={href}>{label}</Link></li>)}</ul>
          </div>
        ))}
      </div>
      <div className="wrap foot-base">
        <span className="body-sm">© 2026 Coffee Snob</span>
        <div className="foot-legal">
          <a href="#" className="body-sm">Privacy</a>
          <a href="#" className="body-sm">Terms</a>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter web build`
Expected: `Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/web-chrome.tsx
git commit -m "Port shared web chrome (nav, footer, signup, letter band)"
```

---

### Task 15: Landing page

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Replace `apps/web/app/page.tsx`** (ported from the design project's `landing.jsx`; the phone-preview `AppSection` is dropped for this pass — the Expo app has no real screens to preview yet, see spec §"Out of scope")

```tsx
import Link from "next/link";
import { Eyebrow, Detour, DETOUR, DETOUR_SUB } from "@/components/primitives";
import { WebNav, LetterBand, WebFooter } from "@/components/web-chrome";
import { SignupForm } from "@/components/signup-form";

const US_CITIES = ["Portland", "Brooklyn", "Chicago", "Oakland", "Austin", "Seattle", "Los Angeles"];
const EU_CITIES = ["Lisbon", "Berlin", "Copenhagen", "Paris", "Milan", "Barcelona", "Rotterdam"];

const JOURNAL_TEASERS = [
  { kicker: "Roasters", title: "Nobody roasts for the second cup", dek: "Ana Beires roasts forty kilos a week in an Alcântara garage and is sold out by Thursday.", photoLabel: "Roaster at the drum, Alcântara garage" },
  { kicker: "Rooms", title: "The case for a bad chair", dek: "Four rooms we keep going back to, none of them comfortable.", photoLabel: "Wooden stool at a tiled counter" },
  { kicker: "Field notes", title: "Three days in Porto, one good espresso", dek: "A bar culture that resists everything specialty coffee wants from it.", photoLabel: "Porto café interior" },
];

const GUIDE_CITIES = [
  { city: "Lisbon", country: "Portugal", shops: 7, detour: 5, href: "/city-guides/lisbon" },
  { city: "Portland", country: "United States", shops: 0, detour: 0, href: undefined },
  { city: "Seattle", country: "United States", shops: 0, detour: 0, href: undefined },
  { city: "Austin", country: "United States", shops: 0, detour: 0, href: undefined },
];

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-type">
        <div className="hero-eyebrow">
          <span className="label">Pre-launch</span>
          <span className="hair" />
          <span className="label">Letter № 001 — Sunday</span>
        </div>
        <h1 className="h1">Find coffee<br />worth the <em>detour</em></h1>
        <div className="hero-sub">
          <p className="lede">A specialty coffee locator, in build. Until it ships we send one letter a week: one shop, one roaster, and the reason it earned the trip.</p>
          <SignupForm />
          <p className="fine">One a week. No round-ups, no affiliate padding. Unsubscribe whenever.</p>
        </div>
      </div>
      <div className="hero-art">
        <div className="photo-ph" data-label="Hero photograph — a counter, mid-service, shot from the customer side" />
      </div>
    </section>
  );
}

function CityBand() {
  const cities = [...US_CITIES.slice(0, 5), ...EU_CITIES.slice(0, 5)];
  return (
    <section className="cityband">
      <div className="cityband-in">
        <span className="label" style={{ color: "var(--oxblood)", flexShrink: 0 }}>Mapped at launch</span>
        <ul className="citylist">
          {cities.map((c) => (
            <li key={c}><Link href={c === "Lisbon" ? "/city-guides/lisbon" : "/city-guides"} className="d4">{c}</Link></li>
          ))}
          <li className="more"><Link href="/city-guides" className="d4">+ 22 more</Link></li>
        </ul>
      </div>
    </section>
  );
}

function Scale() {
  return (
    <section className="scale" style={{ background: "var(--oxblood)", color: "var(--cream)", padding: "104px 0 108px" }}>
      <div className="wrap">
        <div style={{ paddingBottom: 56 }}>
          <Eyebrow color="rgba(233,228,208,.5)">The rating</Eyebrow>
          <h2 className="h2">Five stars tell you<br />nothing. Ours tells<br />you whether to go.</h2>
          <p className="lede on-dark" style={{ marginTop: 18 }}>Every shop in Snob is rated on one question: how far would you travel for it? The scale is a sentence, not a number, and it is the only score we keep.</p>
        </div>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "1px solid rgba(233,228,208,.18)" }}>
          {DETOUR.map((word, i) => (
            <li key={word} style={{ display: "grid", gridTemplateColumns: "52px 78px 300px 1fr", gap: 24, alignItems: "baseline", padding: "26px 0", borderBottom: "1px solid rgba(233,228,208,.18)" }}>
              <span className="num" style={{ fontSize: 15, color: i === 2 ? "var(--burnt)" : "rgba(233,228,208,.4)" }}>{i + 1}</span>
              <Detour value={i + 1} />
              <span className="d2" style={{ color: i === 2 ? "var(--burnt)" : "var(--cream)" }}>{word}</span>
              <span className="body" style={{ color: "rgba(233,228,208,.6)", maxWidth: "56ch" }}>{DETOUR_SUB[i]}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Guides() {
  return (
    <section className="guides" style={{ padding: "104px 0 0" }}>
      <div className="wrap">
        <div className="sec-head">
          <Eyebrow>City guides</Eyebrow>
          <div className="sec-head-row">
            <h2 className="h2">One guide per city,<br />written on the ground.</h2>
            <Link href="/city-guides" className="seeall label-lg">All city guides →</Link>
          </div>
        </div>
        <div className="ggrid">
          {GUIDE_CITIES.map((c) => (
            <Link key={c.city} className="gcard" href={c.href ?? "/city-guides"}>
              <div className="photo-ph gphoto" data-label={`${c.city} — street or counter photograph`} />
              <div className="gline">
                <h3 className="d3">{c.city}</h3>
                <span className="label gcountry">{c.country}</span>
              </div>
              <div className="gmeta">
                <span className="body-sm">{c.shops ? <><span className="num">{c.shops}</span> shops</> : "Guide in progress"}</span>
                {c.detour > 0 && <span className="body-sm gbu"><span className="num">{c.detour}</span> worth the detour</span>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Journal() {
  return (
    <section className="journal" style={{ padding: "104px 0" }}>
      <div className="wrap">
        <div className="sec-head">
          <Eyebrow>The journal</Eyebrow>
          <div className="sec-head-row">
            <h2 className="h2">What we are writing<br />while we build.</h2>
            <Link href="/journal" className="seeall label-lg">All writing →</Link>
          </div>
        </div>
        <div className="jgrid">
          {JOURNAL_TEASERS.map((a) => (
            <article key={a.title} className="jcard">
              <div className="photo-ph cr jphoto" data-label={a.photoLabel} />
              <span className="label jkicker">{a.kicker}</span>
              <h3 className="d3">{a.title}</h3>
              <p className="body">{a.dek}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Founder() {
  return (
    <section style={{ background: "var(--card)", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)", padding: "96px 56px" }}>
      <div style={{ maxWidth: 660, margin: "0 auto" }}>
        <Eyebrow color="var(--ink-3)">Why this exists</Eyebrow>
        <div style={{ marginTop: 32, display: "grid", gap: 20 }}>
          <p className="lede">Placeholder — rewrite this in your own voice. Two or three paragraphs on the trip that started it, the shop you still think about, and what was missing from every app you tried to plan it with.</p>
          <p className="body">Placeholder. Say who Snob is for and who it is not for. Being specific here is what makes people sign up.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 44, paddingTop: 28, borderTop: "1px solid var(--rule)" }}>
          <div className="photo-ph" style={{ width: 56, height: 56, borderRadius: "50%" }} data-label="Portrait" />
          <div>
            <div className="d4">Your name</div>
            <div className="label" style={{ color: "var(--ink-3)", marginTop: 6 }}>Founder, Coffee Snob</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="snob-web">
      <WebNav />
      <Hero />
      <CityBand />
      <Scale />
      <Guides />
      <Journal />
      <Founder />
      <LetterBand />
      <WebFooter />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter web build`
Expected: `Compiled successfully`

- [ ] **Step 3: Start the dev server and visually check the page**

Run: `pnpm --filter web dev`
Visit `http://localhost:3000` — expect: hero with headline "Find coffee worth the detour", sticky nav, oxblood detour-scale section, city guide cards, journal teasers, founder placeholder, oxblood footer. Stop the server after checking (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "Build the landing page"
```

---

### Task 16: City Guides index page

**Files:**
- Create: `apps/web/lib/supabase.ts`
- Create: `apps/web/app/city-guides/page.tsx`

- [ ] **Step 1: Write `apps/web/lib/supabase.ts`** (server-side client using the anon key — all reads in this app are on publicly-readable tables)

```typescript
import { createSupabaseClient } from "@coffeesnob/supabase";

export function getSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Write `apps/web/app/city-guides/page.tsx`** (ported from `city-guides.jsx`; `CITIES` is now a Supabase query rather than a hardcoded array — see spec §"Content model")

```tsx
import Link from "next/link";
import { Eyebrow } from "@/components/primitives";
import { WebNav, WebFooter, LetterBand } from "@/components/web-chrome";
import { getSupabase } from "@/lib/supabase";

export const revalidate = 60;

async function getCityGuidesIndex() {
  const supabase = getSupabase();
  const { data: cities, error } = await supabase
    .from("cities")
    .select("id, slug, name, country, status")
    .order("name");
  if (error) throw error;

  const { data: guides, error: guidesError } = await supabase
    .from("lists")
    .select("city_id, list_items(count)")
    .eq("type", "city_guide");
  if (guidesError) throw guidesError;

  const shopCountByCity = new Map<string, number>();
  for (const guide of guides) {
    const count = (guide.list_items as unknown as { count: number }[])[0]?.count ?? 0;
    shopCountByCity.set(guide.city_id as string, count);
  }

  return cities.map((c) => ({
    ...c,
    shops: shopCountByCity.get(c.id) ?? 0,
    href: c.status === "live" || c.status === "demo" ? `/city-guides/${c.slug}` : undefined,
  }));
}

export default async function CityGuidesPage() {
  const cities = await getCityGuidesIndex();
  const totalShops = cities.reduce((sum, c) => sum + c.shops, 0);

  return (
    <div className="snob-web">
      <WebNav active="City guides" />
      <section className="pagehead">
        <div className="wrap pagehead-in">
          <div>
            <Eyebrow>City guides</Eyebrow>
            <h1 className="h1">Where the<br />coffee is <em>good</em></h1>
          </div>
          <div>
            <p className="lede">One guide per city, written after we have drunk our way through it. No entry we would not walk to ourselves.</p>
            <div style={{ display: "flex", gap: 40, marginTop: 32 }}>
              <div><div className="num" style={{ fontSize: 38 }}>{cities.length}</div><div className="label" style={{ marginTop: 8 }}>Cities mapped</div></div>
              <div><div className="num" style={{ fontSize: 38 }}>{totalShops}</div><div className="label" style={{ marginTop: 8 }}>Shops verified</div></div>
            </div>
          </div>
        </div>
      </section>
      <section className="allcities">
        <div className="wrap">
          <div className="sec-head"><h2 className="h2" style={{ marginTop: 0 }}>Every city</h2></div>
          <div className="cgrid">
            {cities.map((c) => {
              const inner = (
                <>
                  <div className="photo-ph ccard-photo" data-label={`${c.name} — street or counter photograph`} />
                  <div className="ccard-line">
                    <h3 className="d3">{c.name}</h3>
                    <span className="label ccard-country">{c.country}</span>
                  </div>
                  <div className="ccard-meta">
                    <span className="body-sm">{c.shops > 0 ? <><span className="num">{c.shops}</span> shops</> : "Not yet mapped"}</span>
                  </div>
                </>
              );
              return c.href
                ? <Link key={c.id} className="ccard live" href={c.href}>{inner}<span className="ccard-go label">Read guide →</span></Link>
                : <div key={c.id} className="ccard">{inner}<span className="ccard-go label soon">Guide in progress</span></div>;
            })}
          </div>
        </div>
      </section>
      <LetterBand />
      <WebFooter />
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter web build`
Expected: `Compiled successfully` — this build hits the real Supabase project, so it also proves the `.env.local` credentials work

- [ ] **Step 4: Visual check**

Run: `pnpm --filter web dev`, visit `http://localhost:3000/city-guides`
Expected: Lisbon card is clickable ("Read guide →"), the 6 US cities show "Guide in progress". Stop the server after.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/supabase.ts apps/web/app/city-guides/page.tsx
git commit -m "Build City Guides index page (Supabase-backed)"
```

---

### Task 17: City Guide detail page

**Files:**
- Create: `apps/web/app/city-guides/[slug]/page.tsx`

- [ ] **Step 1: Write `apps/web/app/city-guides/[slug]/page.tsx`** (ported from `city-guide.jsx`, dynamic and Supabase-backed instead of hardcoded Lisbon data)

**Reuse `@coffeesnob/supabase`'s `getCityGuide` helper here rather than re-querying inline** — Task 11 fixed it to return `null`/`{ city, guide: null }` instead of throwing on missing rows, specifically so this page (and the Expo app later) can share one query implementation instead of each hand-rolling the same two-query join. If `getCityGuide`'s shape doesn't quite fit this page's needs, that's a signal to adjust the shared helper, not to duplicate it here again.

```tsx
import { notFound } from "next/navigation";
import { Eyebrow, Detour } from "@/components/primitives";
import { WebNav, WebFooter, LetterBand } from "@/components/web-chrome";
import { getSupabase } from "@/lib/supabase";
import { getCityGuide } from "@coffeesnob/supabase";

export const revalidate = 60;

type ShopRow = {
  position: number;
  note: string | null;
  shops: {
    id: string;
    name: string;
    neighborhood: string;
    price_tier: string;
    tag: string | null;
    writeup: string | null;
    order_note: string | null;
    editorial_rating: number | null;
  };
};

export default async function CityGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getCityGuide(getSupabase(), slug);
  if (!result || !result.guide) notFound();
  const { city, guide } = result;
  const items = (guide.list_items as unknown as ShopRow[]).sort((a, b) => a.position - b.position);

  return (
    <div className="snob-web">
      <WebNav active="City guides" />
      <section className="chero">
        <div className="photo-ph chero-photo" data-label={`Hero photograph — ${city.name}, morning counter`} style={{ aspectRatio: "21/9" }} />
        <div className="wrap" style={{ padding: "24px 56px" }}>
          <h1 className="h1">{city.name}</h1>
          <span className="label">{city.country}</span>
        </div>
      </section>
      <section className="cintro">
        <div className="wrap cintro-in">
          <p className="lede">{guide.description}</p>
          {guide.body?.split("\n\n").map((para, i) => <p key={i} className="body cintro-body">{para}</p>)}
        </div>
      </section>
      <section className="clist">
        <div className="wrap">
          <div className="sec-head">
            <Eyebrow>The list</Eyebrow>
            <h2 className="h2">Every shop, with<br />the verdict attached.</h2>
          </div>
          <ol className="slist" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {items.map(({ shops: s, note }) => (
              <li key={s.id} className="srow" style={{ display: "flex", gap: 20, padding: "24px 0", borderTop: "1px solid var(--rule)" }}>
                <div className="photo-ph srow-ph" data-label={`${s.name} — counter`} style={{ width: 140, aspectRatio: "4/3", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <h3 className="d3">{s.name}</h3>
                    <span className="label">{s.neighborhood} · {s.tag} · {s.price_tier}</span>
                  </div>
                  <p className="body" style={{ marginTop: 10 }}>{s.writeup}</p>
                  {s.order_note && <p style={{ marginTop: 8 }}><span className="label">Order</span> <span className="body">{s.order_note}</span></p>}
                  {note && <p className="fine">{note}</p>}
                </div>
                {s.editorial_rating != null && <div style={{ flexShrink: 0 }}><Detour value={s.editorial_rating} short /></div>}
              </li>
            ))}
          </ol>
        </div>
      </section>
      <LetterBand />
      <WebFooter />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter web build`
Expected: `Compiled successfully`

- [ ] **Step 3: Visual check**

Run: `pnpm --filter web dev`, visit `http://localhost:3000/city-guides/lisbon`
Expected: 7 shops render with write-ups, order notes, and detour chip ratings. Visit `http://localhost:3000/city-guides/tampa` — expect Next.js's 404 page (no guide exists yet). Stop the server after.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/city-guides/[slug]/page.tsx
git commit -m "Build City Guide detail page (dynamic, Supabase-backed)"
```

---

### Task 18: Journal — MDX content pipeline

**Files:**
- Create: `apps/web/content/journal/nobody-roasts-for-the-second-cup.mdx`
- Create: `scripts/generate-journal-stubs.mjs`
- Create: `apps/web/lib/journal.ts`

- [ ] **Step 1: Write the one fully-authored post — `apps/web/content/journal/nobody-roasts-for-the-second-cup.mdx`** (body ported verbatim from the design project's `journal-post.jsx`)

```mdx
---
title: "Nobody roasts for the second cup"
category: "Roasters"
author: "Mara Kessler"
date: "2026-08-16"
readMinutes: 9
photoAlt: "Roaster at the drum, Alcântara garage — morning light through a roll-up door"
dek: "Ana Beires roasts forty kilos a week in an Alcântara garage and is sold out by Thursday. We spent a morning watching her reject three lots in a row."
---

The garage is on a hill, behind a shuttered tile shop, and at half past six in the morning it smells like a bakery that has made a mistake. Ana Beires has been awake since four. The drum has been up to temperature for an hour. On the bench beside her there are three cupping bowls, all of them full, all of them going down the sink.

"That one is flat," she says of the first, without much ceremony. "That one is a lot of money and it tastes like a supermarket." The third she does not comment on at all, which is worse. Forty kilos a week leave this room. She has turned down about nine hundred kilos this year.

Beires roasted commercially for eleven years before she started Corvo, seven of them for a company whose bags you have seen in an airport. She left in 2023 with a shortlist of producers and a rule she repeats often enough that it has become the closest thing the company has to a mission statement.

> "I am not roasting for the person who drinks it black at eight and then forgets about it. I am roasting for the one who stops halfway down the cup."
>
> — Ana Beires, Corvo

That sounds like a slogan until you watch it decide something. Halfway through the morning a wholesale account calls: they want a lighter version of a Colombian she sells them, something that will read as fruit at 92 degrees in a cafe with a bad grinder. She says no on the phone, in under a minute, and then explains to us for ten why the answer is no.

## Forty kilos, and a Thursday problem

Corvo sells out most weeks by Thursday afternoon, which sounds like success and is mostly a constraint. Beires roasts on a 5kg drum she bought second hand from a closed roastery in Braga. Eight batches is a comfortable morning. Twelve is a bad one.

The obvious move is to raise prices. She has, twice, and will not do it again this year: her retail bag is now €19 for 250g. The second obvious move is to buy cheaper green. That is the one she will not discuss for longer than a sentence.

> "Every roaster my size has the same choice. You grow by getting worse, or you stay small and get told you have no ambition."
>
> — Ana Beires, Corvo

## What the trier is actually for

Beires cups every batch the following morning, alone, before the espresso machine goes on. Ask her what she is listening for at the end of a roast and she does not say caramelisation or sugar browning. She says the second cup.

**Where to drink it:** Corvo — Alcântara, Lisbon. No shopfront. Bags and a two-group machine, Thursday and Friday, 8am until it is gone.

Corvo's next release is a washed Kenyan from Nyeri, roasted for filter, about 60 kilos in total. It will be gone by Thursday.
```

- [ ] **Step 2: Write `scripts/generate-journal-stubs.mjs`** (one-time codegen — generates frontmatter-only stub posts for the remaining Journal teasers from the design project's `journal-data.jsx`, so the index page grid has real-shaped content while the full articles get written later)

```javascript
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Ported from screens/journal-data.jsx in the Claude Design project.
// "nobody-roasts-for-the-second-cup" is excluded — it's hand-authored in full already.
const STUBS = [
  { slug: "the-case-for-a-bad-chair", title: "The case for a bad chair", category: "Rooms", author: "Theo Reyes", date: "2026-08-12", readMinutes: 7, photoAlt: "Wooden stool at a tiled counter, no cushion", dek: "Four rooms we keep going back to, none of them comfortable. On cafés designed for forty minutes rather than four hours." },
  { slug: "three-days-in-porto", title: "Three days in Porto, one good espresso", category: "Field notes", author: "Inês Lopes", date: "2026-08-09", readMinutes: 6, photoAlt: "Porto café interior, marble counter and standing customers", dek: "More cafés per head than almost anywhere in Europe, and a bar culture that resists everything specialty coffee wants from it." },
  { slug: "stop-grinding-finer", title: "Stop grinding finer", category: "Brewing", author: "Yael Sassoon", date: "2026-08-05", readMinutes: 5, photoAlt: "Ground coffee in a dosing cup, overhead", dek: "Your filter is bitter and it is not the grinder's fault. A short argument for changing one variable at a time." },
  { slug: "the-kettle-question-settled", title: "The kettle question, settled", category: "Gear", author: "Theo Reyes", date: "2026-08-02", readMinutes: 11, photoAlt: "Six kettles lined up on a bench, flat lay", dek: "Six pouring kettles through eight weeks of service. Two are worth the money and only one is worth the counter space." },
  { slug: "what-a-co-ferment-actually-costs", title: "What a co-ferment actually costs", category: "Roasters", author: "Mara Kessler", date: "2026-07-28", readMinutes: 12, photoAlt: "Fermentation tanks on a Colombian finca", dek: "Producers are being asked to gamble a harvest on a flavour trend. We followed the money from a Colombian finca to a Berlin menu." },
  { slug: "standing-room-only", title: "Standing room only", category: "Rooms", author: "Inês Lopes", date: "2026-07-24", readMinutes: 5, photoAlt: "Narrow Paris standing bar seen from the doorway", dek: "Paris kept the counter and lost the couch. Notes on the standing bar as the most honest format in coffee." },
];

const DIR = new URL("../apps/web/content/journal/", import.meta.url).pathname;

for (const stub of STUBS) {
  const path = join(DIR, `${stub.slug}.mdx`);
  if (existsSync(path)) continue;
  const frontmatter = [
    "---",
    `title: "${stub.title}"`,
    `category: "${stub.category}"`,
    `author: "${stub.author}"`,
    `date: "${stub.date}"`,
    `readMinutes: ${stub.readMinutes}`,
    `photoAlt: "${stub.photoAlt}"`,
    `dek: "${stub.dek}"`,
    "---",
    "",
    `${stub.dek}`,
    "",
    "_Full piece not yet written._",
    "",
  ].join("\n");
  writeFileSync(path, frontmatter);
  console.log(`wrote ${path}`);
}
```

- [ ] **Step 3: Run the codegen**

Run: `node scripts/generate-journal-stubs.mjs`
Expected: 6 lines of `wrote .../apps/web/content/journal/<slug>.mdx`

- [ ] **Step 4: Write `apps/web/lib/journal.ts`**

```typescript
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

const JOURNAL_DIR = join(process.cwd(), "content", "journal");

export type JournalFrontmatter = {
  title: string;
  category: string;
  author: string;
  date: string;
  readMinutes: number;
  photoAlt: string;
  dek: string;
};

export type JournalPost = { slug: string; frontmatter: JournalFrontmatter; content: string };

export function getAllJournalPosts(): JournalPost[] {
  return readdirSync(JOURNAL_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((file) => {
      const raw = readFileSync(join(JOURNAL_DIR, file), "utf8");
      const { data, content } = matter(raw);
      return { slug: file.replace(/\.mdx$/, ""), frontmatter: data as JournalFrontmatter, content };
    })
    .sort((a, b) => (a.frontmatter.date < b.frontmatter.date ? 1 : -1));
}

export function getJournalPost(slug: string): JournalPost | undefined {
  return getAllJournalPosts().find((p) => p.slug === slug);
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/content/journal scripts/generate-journal-stubs.mjs apps/web/lib/journal.ts
git commit -m "Add Journal MDX content pipeline and seed posts"
```

---

### Task 19: Journal index + post pages

**Files:**
- Create: `apps/web/app/journal/page.tsx`
- Create: `apps/web/app/journal/[slug]/page.tsx`

- [ ] **Step 1: Write `apps/web/app/journal/page.tsx`** (ported from `journal.jsx`)

```tsx
import Link from "next/link";
import { Eyebrow, Avatar } from "@/components/primitives";
import { WebNav, WebFooter } from "@/components/web-chrome";
import { getAllJournalPosts } from "@/lib/journal";

export default function JournalIndexPage() {
  const posts = getAllJournalPosts();
  const [featured, ...rest] = posts;

  return (
    <div className="snob-web">
      <WebNav active="Journal" />
      <section className="pagehead">
        <div className="wrap pagehead-in">
          <div>
            <Eyebrow>Journal</Eyebrow>
            <h1 className="h1">Reported from<br />the <em>counter</em></h1>
          </div>
          <p className="lede">Roaster interviews, rooms worth sitting in, and what we learned drinking our way through a city. Everything here was paid for by us, and nothing here was placed.</p>
        </div>
      </section>
      {featured && (
        <section className="jfeat wrap" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 48, paddingBottom: 64 }}>
          <div className="photo-ph" data-label={featured.frontmatter.photoAlt} style={{ aspectRatio: "4/3" }} />
          <div>
            <span className="label jkicker">{featured.frontmatter.category}</span>
            <Link href={`/journal/${featured.slug}`}><h2 className="h2">{featured.frontmatter.title}</h2></Link>
            <p className="lede" style={{ marginTop: 16 }}>{featured.frontmatter.dek}</p>
            <div className="byline" style={{ marginTop: 24 }}>
              <Avatar name={featured.frontmatter.author} size={26} />
              <span className="label bl-name">{featured.frontmatter.author}</span>
              <span className="bl-dot" />
              <span className="label bl-meta">{featured.frontmatter.readMinutes} min</span>
            </div>
          </div>
        </section>
      )}
      <section className="jindex">
        <div className="wrap">
          <div className="sec-head"><h2 className="h2" style={{ marginTop: 0 }}>Everything else</h2></div>
          <div className="pgrid">
            {rest.map((p) => (
              <article key={p.slug} className="pcard">
                <Link href={`/journal/${p.slug}`} className="pcard-link">
                  <div className="photo-ph pcard-photo" data-label={p.frontmatter.photoAlt} />
                  <span className="label pcard-kicker">{p.frontmatter.category}</span>
                  <h3 className="d2 pcard-title">{p.frontmatter.title}</h3>
                  <p className="body pcard-dek">{p.frontmatter.dek}</p>
                </Link>
                <div className="pcard-foot">
                  <span className="label pcard-author">{p.frontmatter.author}</span>
                  <span className="label pcard-meta">{p.frontmatter.readMinutes} min</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <WebFooter />
    </div>
  );
}
```

- [ ] **Step 2: Write `apps/web/app/journal/[slug]/page.tsx`** (ported from `journal-post.jsx`)

```tsx
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { Avatar } from "@/components/primitives";
import { WebNav, WebFooter, LetterBand } from "@/components/web-chrome";
import { getJournalPost, getAllJournalPosts } from "@/lib/journal";

export function generateStaticParams() {
  return getAllJournalPosts().map((p) => ({ slug: p.slug }));
}

export default async function JournalPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getJournalPost(slug);
  if (!post) notFound();

  return (
    <div className="snob-web">
      <WebNav active="Journal" />
      <header className="posthead">
        <div className="wrap posthead-in">
          <span className="label ph-kicker">{post.frontmatter.category}</span>
          <h1 className="h1 ph-title">{post.frontmatter.title}</h1>
          <p className="lede ph-dek">{post.frontmatter.dek}</p>
          <div className="ph-foot">
            <div className="byline">
              <Avatar name={post.frontmatter.author} size={30} />
              <span className="label bl-name">{post.frontmatter.author}</span>
              <span className="bl-dot" />
              <span className="label bl-meta">{post.frontmatter.readMinutes} min read</span>
            </div>
          </div>
        </div>
        <div className="ph-photo photo-ph" data-label={post.frontmatter.photoAlt} />
      </header>
      <section className="post">
        <div className="wrap post-in" style={{ gridTemplateColumns: "1fr" }}>
          <div className="post-col">
            <MDXRemote source={post.content} />
          </div>
        </div>
      </section>
      <LetterBand />
      <WebFooter />
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter web build`
Expected: `Compiled successfully`, and the build log shows 7 static params generated for `/journal/[slug]`

- [ ] **Step 4: Visual check**

Run: `pnpm --filter web dev`, visit `http://localhost:3000/journal` and `http://localhost:3000/journal/nobody-roasts-for-the-second-cup`
Expected: index shows the featured post + 6 stub cards; the post page renders the full article with headings and blockquotes styled. Stop the server after.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/journal
git commit -m "Build Journal index and post pages"
```

---

### Task 20: Deploy — repoint Vercel + push to GitHub

> **Already completed ahead of order** (done mid-Task-16 at the user's request, once they'd connected the repo themselves). Documenting what actually happened, since it differs from the original draft above this note:
>
> - The repo the user connected was `https://github.com/ethan8damax/Coffee-SNOB.git` (not `Snob.git` as guessed in the original spec) — `git remote -v` already showed this configured (by the user, via Vercel's GitHub integration or directly) by the time this task ran. A normal `git push origin main` (no force needed) synced everything.
> - The Vercel project is `coffee-snob-project`. Its Root Directory was left at `.` (repo root) by default, which broke Next.js framework auto-detection (`vercel deploy` failed: "No Next.js version detected" — it was scanning the monorepo root's `package.json`, which has no `next` dependency). Fixed via `vercel project update coffee-snob-project --root-directory apps/web --framework nextjs --install-command "cd ../.. && pnpm install"` — **not** via a repo-root `vercel.json` buildCommand hack. With Root Directory set to `apps/web`, Next.js's own defaults (`next build`, output `.next`) work unmodified; `vercel.json` only needs `{ "framework": "nextjs" }`.
> - The project already had stale env vars from the *old* Supabase project, under the *wrong* names too (`SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` — missing the `NEXT_PUBLIC_` prefix the code actually reads). Removed all three, added `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` for Production, Preview, and Development via `vercel env add <name> <env> --value <value> --yes`.
> - Hit and fixed a real Vercel CLI bug: v54.10.2's `env add ... preview --value ... --yes` silently ignored `--value` and re-prompted for the git branch; also silently corrupted the Development values added via piped stdin (verified via `vercel env pull`, caught because the CLI displayed the mangled value). Both fixed by updating to `vercel@latest` (v59.3.0) and re-adding cleanly, then verifying with `vercel env pull` that the actual decoded values matched what was intended — don't trust "Added Environment Variable" success output alone with this CLI version if a fresher one is available.
> - `vercel deploy --yes` then failed a third way: Vercel's dependency security scan blocked the deploy over `next-mdx-remote@5.0.0` (a known vulnerability) — the version pinned in Task 2's `apps/web/package.json`, unused by any code until Task 18. Bumped to `^6.0.0`, reinstalled, rebuilt clean.
> - Final `vercel deploy --prod --yes` succeeded. Verified against the real production alias (`https://coffeesnobproject.com`, not the auto-generated `*.vercel.app` URL — that one redirects through Vercel SSO for team members and isn't a useful public-reachability check) with `curl`: landing page 200 with real hero copy, `/city-guides` 200 showing the live Lisbon guide alongside "Guide in progress" for the 6 real launch cities.
>
> Original draft below, kept for reference on what was intended before the above corrections:

**Files:** none (infra/config only)

- [ ] **Step 1: Configure the monorepo build in Vercel**

In the Vercel project settings (or via `vercel.json` at the repo root):

```json
{
  "buildCommand": "cd ../.. && pnpm turbo run build --filter=web",
  "installCommand": "pnpm install",
  "outputDirectory": ".next"
}
```
Set the Vercel project's Root Directory to `apps/web`.

- [ ] **Step 2: Update Vercel environment variables to point at the new Supabase project**

Run (from repo root, requires `vercel` CLI linked to the existing project):
```bash
vercel env rm NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
```
Paste the values interactively when prompted (do not write secrets to any file). Repeat for `preview` and `development` environments if they point at the old project too.

- [ ] **Step 3: Point the git remote at the existing repo and push**

```bash
git remote add origin https://github.com/ethan8damax/Snob.git
git push --force origin main
```
(Force push is intentional here — the user explicitly authorized fully overwriting the existing repo contents.)

- [ ] **Step 4: Verify the Vercel deployment**

Watch the deployment in the Vercel dashboard, or:
Run: `vercel inspect <deployment-url> --logs`
Expected: build succeeds, and the deployed site's `/city-guides/lisbon` renders the same content verified locally in Task 17.

- [ ] **Step 5: No commit needed** (this task is infra configuration, not a code change)

---

## Phase E — Expo app (shell only, per spec)

### Task 21: Wire Supabase into the Expo app

**Files:**
- Modify: `apps/app/package.json`
- Create: `apps/app/lib/supabase.ts`
- Create: `apps/app/.env`
- Modify: `apps/app/app/(tabs)/index.tsx`

- [ ] **Step 1: Add dependencies**

Run: `cd apps/app && npx expo install @supabase/supabase-js react-native-url-polyfill`
Then add the workspace dependency by hand to `apps/app/package.json`:
```json
{
  "dependencies": {
    "@coffeesnob/supabase": "workspace:*"
  }
}
```

- [ ] **Step 2: Write `apps/app/.env`** (gitignored — Expo reads `EXPO_PUBLIC_*` vars at build time)

```
EXPO_PUBLIC_SUPABASE_URL=<same value as apps/web's NEXT_PUBLIC_SUPABASE_URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<same value as apps/web's NEXT_PUBLIC_SUPABASE_ANON_KEY>
```

- [ ] **Step 3: Write `apps/app/lib/supabase.ts`**

```typescript
import "react-native-url-polyfill/auto";
import { createSupabaseClient } from "@coffeesnob/supabase";

export const supabase = createSupabaseClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);
```

- [ ] **Step 4: Prove the wiring works — update the Home stub to fetch and display live city count**

```tsx
import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { supabase } from "@/lib/supabase";

export default function HomeScreen() {
  const [cityCount, setCityCount] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("cities")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setCityCount(count ?? 0));
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Home — discovery feed (not yet built)</Text>
      <Text>{cityCount === null ? "Loading cities…" : `${cityCount} cities in Supabase`}</Text>
    </View>
  );
}
```

- [ ] **Step 5: Verify the web export still builds with the Supabase client wired in**

Run: `cd apps/app && npx expo export -p web`
Expected: `Exported: dist`, no errors

- [ ] **Step 6: Manual check**

Run: `cd apps/app && npx expo start --web`, open the printed localhost URL
Expected: Home tab shows "7 cities in Supabase" (6 launch cities + Lisbon demo). Stop the server after.

- [ ] **Step 7: Commit**

```bash
git add apps/app
git commit -m "Wire Supabase client into the Expo app"
```

---

## Self-Review Notes

- **Spec coverage:** every item in the spec's "This session's build order" (1–5) maps to a phase above. Content-model decisions (Journal→MDX, city guides/collections→Supabase) are implemented in Tasks 16–19. Auth/RLS/schema from the spec are in Tasks 7–9. Design-token porting is Task 12. Out-of-scope items from the spec (full Expo screen port, App Store submission, OAuth provider console setup, search/ranking) have no tasks here — correctly, since the spec excludes them.
- **Placeholder scan:** the Landing page's "Founder" section and 6 of 7 Journal posts intentionally contain unfinished/placeholder prose — these are carried over verbatim from the design project's own explicit placeholder copy (meant for the human founder to write) and are called out as stubs in code comments, not vague instructions to a future engineer.
- **Type consistency:** `getCityGuide` in `packages/supabase/src/queries.ts` (Task 11) and the inline Supabase queries in Tasks 16–17 use matching column/table names (`lists`, `list_items`, `shops`, `editorial_rating`, `order_note`) traceable back to the exact migrations in Tasks 7–9.
