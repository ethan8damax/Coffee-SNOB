# Coffee Snob — Auth & Session Design

Date: 2026-08-22

## Context

Coffee Snob's Expo app (`apps/app`) is currently a 5-tab navigation shell with
stub screens and no auth. Most of the product — profile, log-a-visit, saving
collections, following people — only makes sense with a real signed-in user.
This spec covers standing up Supabase Auth (email/password), session
handling, and a trimmed onboarding flow. It is the first of two sub-projects;
the second (the real content of the 9 product screens: home, map, shop, log,
lists, discovery, account, profile, wide/wide-tablet) is deliberately
deferred until this ships, so those screens get built against a real session
from day one instead of stub/no-auth state.

A visual design for these screens exists in the Claude Design project
(`019df027-97af-74d2-a376-2a823fc1ddc5`), specifically `screens/account.jsx`
(`SignInScreen`), `screens/onboarding.jsx` (7-step onboarding shell, steps
1/2/4/5/6/7), and `screens/lists-onboarding.jsx` (`OnboardingScreen`, step 3
· Taste). As with the marketing site, these `.jsx` files are Claude Design's
live-preview format — visual/content reference to port from, not code to
import verbatim.

## Decisions

**Scope: email/password only, this pass.** Apple and Google sign-in are
explicitly out of scope — neither developer console (Apple Developer
Program, Google Cloud OAuth client) is set up yet, and that setup is manual
work outside this session (Apple enrollment costs $99/yr and takes up to 48h
to approve). The sign-in screen's Apple/Google buttons from the design are
omitted entirely rather than rendered disabled — nothing dead in the UI.
`createSupabaseClient`'s auth config is structured so adding providers later
doesn't require touching this pass's code, but no provider-specific code is
written now.

**Auth gates the whole app.** There is no signed-out browsing state. Every
screen renders behind a session; the first thing an unauthenticated user
sees is Sign In. This avoids every screen needing to handle both signed-in
and signed-out variants.

**Routing: Context + Expo Router segment redirects.** A root `AuthProvider`
holds `session`, `profile` (the current user's `profiles` row), and
`loading`, fetched together on mount and on every `onAuthStateChange` event.
`app/_layout.tsx` reads that state and renders one of three route groups —
no per-screen guards, no separate state library (Context is enough for one
slice of state):

- No session → `(auth)`: sign-in, sign-up, check-email, forgot-password,
  reset-password
- Session, `profile.onboarded_at` is null → `(onboarding)`: identity, taste
- Session, onboarded → `(tabs)`: the existing 5-tab shell

**Onboarding is trimmed to steps 1 (Identity) and 3 (Taste) of the design's
7-step flow.** Steps 2 (home city + follow cities), 4 (room/filter
preferences), 5 (follow suggestions), 6 (rate three shops you know), and 7
(notification prefs) all depend on schema, data, or features that don't
exist yet:

- Step 2 needs a home-city column and a city-follows join table
- Step 4 needs a room-preferences array column
- Step 5 needs real users or a seeded editorial "desk" account to suggest —
  none exist at launch
- Step 6 needs real shop data in the user's city; only the Lisbon *demo*
  city has shops, none of the six real launch cities do yet
- Step 7 needs a notification-preferences table and, eventually, actual push
  infrastructure

None of these get faked or stubbed — they're separate future work, sequenced
after the features they depend on land. Step 1 (username, name, avatar) and
step 3 (taste picks) map directly onto the existing `profiles` schema
(`username`, `avatar_url`, `taste_picks`) and ship for real this pass.

**Avatar: initials only, no upload.** Step 1's "Add photo" is skipped this
pass — the `Avatar` primitive already renders initials-on-color as a real
fallback, not a placeholder. Real photo upload needs a Supabase Storage
bucket + RLS policies + `expo-image-picker`, deferred to a small follow-up.

**Password reset is in scope.** `resetPasswordForEmail` + a reset screen,
matching the "Forgotten?" link already in the design. Reset links deep-link
into the app via the existing `coffeesnob://` custom scheme
(`coffeesnob://reset-password`) — no universal-links/associated-domains setup
this pass; that's a fast follow if the custom-scheme prompt proves annoying.

**Email confirmation is required.** Supabase's default — sign up shows
"check your email," the user confirms via link, then signs in. Prevents
throwaway addresses and matches a social app with public usernames.

## Data model change

One column added to `profiles`:

```sql
alter table public.profiles add column onboarded_at timestamptz;
```

Nullable, set once when the user finishes the taste-picks step. An explicit
column beats inferring "onboarded" from `taste_picks` being non-empty — a
user who genuinely picks zero tags shouldn't get routed back into
onboarding.

Username uniqueness is already enforced by the existing `unique` constraint
on `profiles.username`; the Identity screen's live "Available" check is a
debounced `select` against that column (already publicly readable under
existing RLS) with the constraint as the real backstop against races.

## Session handling

`packages/supabase`'s `createSupabaseClient(url, anonKey)` gains an optional
third `options` parameter carrying Supabase's `auth` client options (storage
adapter, `autoRefreshToken`, `persistSession`, `detectSessionInUrl`). Same
factory, platform-appropriate storage:

- `apps/app/lib/supabase.ts` passes an `expo-secure-store`-backed storage
  adapter (new dependency) with `autoRefreshToken: true`,
  `persistSession: true`, `detectSessionInUrl: false`.
- `apps/web` continues passing no override and gets supabase-js's default
  browser storage — unchanged.

## Screens (this pass)

- **Sign in** — email/password fields, "Forgotten?" link, "Create an
  account" link. No social buttons (see Scope above).
- **Sign up** — email/password only.
- **Check email** — static confirmation-required notice shown after sign-up
  and after a password-reset request.
- **Forgot password** — email field, triggers `resetPasswordForEmail`.
- **Reset password** — lands from the `coffeesnob://reset-password` deep
  link carrying a recovery token in its query params; the app exchanges that
  token for a session (`detectSessionInUrl` is `false` on Expo, since
  there's no `window.location` to auto-parse — this exchange is manual, via
  `expo-linking` to read the URL and `supabase.auth.setSession`/
  `exchangeCodeForSession`), then shows the new-password field and routes to
  sign-in.
- **Onboarding · Identity** — name, handle/username (with the availability
  check), and the initials `Avatar` preview.
- **Onboarding · Taste** — the five drink-preference picks from
  `lists-onboarding.jsx`'s `OnboardingScreen`; writes `taste_picks`, sets
  `onboarded_at`, routes into `(tabs)`.

## Primitives ported (React Native)

Only what these screens use, via `react-native-svg` where the design uses
inline SVG — not the full `Icon` set, which expands screen-by-screen as
later work needs it:

- `Script` (the wordmark logo, used on Sign In)
- `Avatar` (initials-on-color)
- `Eyebrow` (label + rule divider)
- Typography (`d1`–`d4`, `body`, `body-sm`, `label`) as RN `StyleSheet`
  constants, using `packages/design-tokens` colors
- The two button styles (`btn-ox` solid, `btn-line` outlined)

## Out of scope for this pass

- Apple Sign In, Google Sign In, and their developer-console setup.
- Real avatar photo upload (Storage bucket, image picker).
- Onboarding steps 2, 4, 5, 6, 7 (home city, room filters, follow
  suggestions, rate-three-shops, notification prefs) — each depends on
  schema/data/features that don't exist yet; each becomes its own future
  spec once its dependency lands.
- Universal links / associated domains for password-reset deep linking
  (custom URL scheme is used instead).
- The remaining 9 product screens (home, map, shop, log, lists, discovery,
  account, profile, wide/wide-tablet) — next sub-project, built against the
  real session this spec produces.
