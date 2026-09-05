# Anonymous Map Access — Design

## Problem

The marketing site's nav is meant to offer a no-account map CTA ("See what's
near you" replacing the redundant "Create account" button — see
`docs/superpowers/plans/2026-09-03-map-screen.md` and prior session
discussion), on the premise that browsing the map needs no account and
signing in is only required to save or rate a shop.

The app doesn't actually support this today. `apps/app/app/_layout.tsx`
picks one of four root route groups via `resolveRouteGroup()`
(`apps/app/lib/auth/resolve-route-group.ts`), and that decision is made
once, before any per-screen routing: no session means the whole app is
`(auth)`, with no exceptions. A marketing-site visitor tapped straight into
`/map` while logged out is sent to sign-up instead, never seeing the map.

## Data layer: no changes needed

Confirmed all three tables the map reads from are already public-read RLS
policies with no auth requirement: `shops`, `shop_curations`, and `logs`
each have `for select using (true)` (migrations `0001`, `0008`, `0003`
respectively). The `shop_ratings` view is `security_invoker`, so it runs
under the querying role's own (public) permissions. `apps/web`'s
`/api/nearby-shops` OSM proxy has no auth check either. This is purely a
client-side routing/gating problem.

## Design

### 1. Root gate carve-out

Add a new `isPublicTabRoute: boolean` parameter to `resolveRouteGroup`,
computed at the call site the same way `isRecoveryRoute` already is today
(`pathname === "/reset-password"`) — i.e. `apps/app/app/_layout.tsx` computes
`isPublicTabRoute: pathname === "/map"` and passes it in. `resolveRouteGroup`
stays pathname-string-agnostic; it only reasons about booleans, which keeps
it trivially unit-testable exactly as it is today.

Updated logic:

```
if (isRecoveryRoute) return "reset-password";
if (!hasSession) return isPublicTabRoute ? "(tabs)" : "(auth)";
return onboarded ? "(tabs)" : "(onboarding)";
```

A logged-out visitor on `/map` now resolves to `(tabs)` instead of `(auth)`;
every other path is unaffected. Onboarding is correctly bypassed for
anonymous visitors (it was already gated behind `hasSession` first).

**Resolved (as implemented):** this section's carve-out was itself wrong.
`usePathname()` is a global, app-wide hook, not scoped to whichever
navigator has focus — so `RootNavigator` re-renders and recomputes `group`
on every pathname change anywhere in the app, including tab switches inside
the nested `(tabs)` navigator. A carve-out limited to `pathname === "/map"`
meant that the instant an anonymous visitor tapped any other tab (or a
signed-in user signed out while on a gated tab), `isPublicTabRoute` flipped
false and the entire `(tabs)` group was evicted, redirecting into `(auth)`
instead of showing that tab's `SignInPrompt`. Found during final review;
fixed by broadening the check to every tab path via a new `isPublicTabPath`
helper (`apps/app/lib/auth/resolve-route-group.ts`), so the root gate just
decides whether an anonymous visitor is let into the `(tabs)` experience at
all, and the already-correct per-screen `SignInPrompt` checks do the actual
content gating.

Extend `apps/app/lib/auth/resolve-route-group.test.ts` with cases for the
new parameter: public route + no session → `(tabs)`; public route + session
→ unaffected (existing behavior); non-public route + no session → `(auth)`
(existing behavior, confirms no regression).

### 2. Sign-in placeholder on the other tabs

The tab bar (`apps/app/app/(tabs)/_layout.tsx`) is unchanged — all five tabs
stay visible for everyone, per explicit decision (not hidden, not redirected
away from on tap).

Add a shared `apps/app/components/sign-in-prompt.tsx`: a short message plus
two links, `Sign in` → `/sign-in` and `Create account` → `/sign-up` (plain
Expo Router `<Link>`, matching the convention already used in
`app/(auth)/*.tsx`).

Each of `(tabs)/index.tsx`, `(tabs)/log.tsx`, `(tabs)/lists.tsx`, and
`(tabs)/profile.tsx` reads `session` from `useAuth()` and renders
`<SignInPrompt />` in place of its current stub body when `!session`. This
is a one-line early-return added to each of four already-trivial stub
screens — no other changes to them.

### 3. The map screen needs no changes

`(tabs)/map.tsx` already only reads public data and never assumes a
session. Its "Directions" action already requires no auth. Its "Log a
visit" action already just navigates to `/(tabs)/log` — which, once gated
per section 2, shows the sign-in prompt automatically for anonymous
visitors. No map-specific auth branching is needed.

## Explicitly out of scope

- **Resuming the log-a-visit flow after sign-up.** Tapping "Log a visit"
  while anonymous lands on the sign-in prompt with no memory of which shop
  was tapped; after authenticating, the visitor returns to the map and taps
  it again. The Log screen is still a stub (per the map-screen plan's own
  "out of scope" note), so there's no real flow to resume yet — revisit
  this once that screen is actually built.
- **Any other public route.** Only `/map` is carved out. Adding another
  public tab later is a one-line addition to the `isPublicTabRoute`
  computation, not a redesign.
- **A standalone anonymous-only map page outside the tab bar.** Considered
  and rejected — it would duplicate the map screen and contradicts the
  decision to keep the real tab bar visible with a sign-in placeholder on
  the other tabs.
