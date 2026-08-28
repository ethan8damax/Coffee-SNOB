# Landing Page Product-Led Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the newsletter-first marketing site (weekly Sunday letter, "Get the letter" CTA) with an accounts-first, three-door landing page — create an account and start rating, join the phone-app waitlist, or browse the city guides — backed by a real, reachable deployment of the already-built auth/onboarding flow.

**Architecture:** `apps/app` (Expo Router + `react-native-web`) already builds a static web export via `npm run build:web`. This plan deploys that export to a new Vercel project at `app.coffeesnobproject.com` so `apps/web`'s CTAs have a real destination, then reworks the marketing site's homepage and shared chrome around three consistent CTAs instead of one email-capture funnel, with three scroll-triggered motion treatments tied to existing brand elements (hairline rules, color bands, the Detour chevrons).

**Tech Stack:** Next.js App Router (`apps/web`), Expo Router + `react-native-web` (`apps/app`), Vercel, Supabase.

**Spec:** `docs/superpowers/specs/2026-08-28-landing-page-product-led-redesign-design.md`

---

## File Structure

**New files:**
- `apps/app/vercel.json` — build config for the Expo web export.
- `apps/web/lib/app-url.ts` — single source of truth for the deployed app's base URL.
- `apps/web/components/scroll-reveal.tsx` — client component, one shared `IntersectionObserver` mounted once in the root layout.

**Modified files:**
- `apps/web/app/layout.tsx` — mount `<ScrollReveal />`.
- `apps/web/app/globals.css` — motion classes (`[data-reveal]`, `[data-reveal-hair]`, `.band-fade`, chevron stagger), new `.doors` panel styles, `prefers-reduced-motion` override.
- `apps/web/components/primitives.tsx` — `Eyebrow`'s `.hair` element gets `data-reveal-hair` (cascades the hairline-draw motion to every section that uses `Eyebrow`, no per-call-site changes needed); `Scale`'s chevron opacity moves from an inline `opacity` prop to a `--fill-opacity` CSS variable so it can animate in.
- `apps/web/components/web-chrome.tsx` — `WebNav` gets a real "Sign in" link and a "Create account" CTA; `LetterBand` is deleted; new `Doors` (three-panel recap strip) component added.
- `apps/web/app/page.tsx` — `Hero` rewritten (singular CTA + kept photo), `AppComingSoon` renamed `GetTheApp` (band-fade motion, honest native-only copy), `Guides` gets a door-3 CTA, `Journal` call removed, section order updated, `LetterBand` swapped for `Doors`.
- `apps/web/app/city-guides/page.tsx`, `apps/web/app/city-guides/[slug]/page.tsx`, `apps/web/app/journal/page.tsx`, `apps/web/app/journal/[slug]/page.tsx` — swap `<LetterBand />` for `<Doors />`.

No new dependencies. No test framework exists for `apps/web` today (it's markup/CSS/copy, no unit-testable logic) — verification is typecheck + lint + browser check, matching the pattern from the prior audit-fix passes.

---

### Task 1: Deploy the Expo web export to a real subdomain

**Files:**
- Create: `apps/app/vercel.json`

This is the one task in this plan that provisions shared infrastructure (a new Vercel project, a new DNS record). **Stop and get explicit confirmation from the user before running Steps 3–6** — do not run them unattended even though they're written out concretely below.

- [ ] **Step 1: Add Vercel build config**

```json
{
  "buildCommand": "npm run build:web",
  "outputDirectory": "dist",
  "framework": null
}
```

Save as `apps/app/vercel.json`.

- [ ] **Step 2: Confirm the env vars the build needs**

```bash
cat apps/app/.env
```

Expected: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (already present locally, not committed — `.env*` is gitignored). These are the two values the new Vercel project needs.

- [ ] **Step 3 (confirm with user first): Link a new Vercel project for `apps/app`**

```bash
cd apps/app && vercel link
```

When prompted, create a **new** project (do not link to the existing `coffee-snob-project`). Suggested name: `coffee-snob-app`.

- [ ] **Step 4 (confirm with user first): Set the production env vars on the new project**

```bash
cd apps/app
vercel env add EXPO_PUBLIC_SUPABASE_URL production
vercel env add EXPO_PUBLIC_SUPABASE_ANON_KEY production
```

Paste the values from `apps/app/.env` when prompted for each.

- [ ] **Step 5 (confirm with user first): Deploy to production**

```bash
cd apps/app && vercel --prod
```

Expected: a `*.vercel.app` production URL is printed. Visit `<url>/sign-up` and `<url>/sign-in` and confirm both render the real screens (not a 404).

- [ ] **Step 6 (confirm with user first): Add the custom domain**

```bash
cd apps/app && vercel domains add app.coffeesnobproject.com
```

Vercel will print the DNS record to add (typically a `CNAME` for `app` pointing at `cname.vercel-dns.com`). **This step is manual** — the user (or whoever holds GoDaddy registrar access) adds that record; it isn't something to automate. Note the exact record Vercel prints so it can be handed off.

- [ ] **Step 7: Verify**

Once DNS propagates: visit `https://app.coffeesnobproject.com/sign-up` and confirm it loads the real sign-up screen.

---

### Task 2: Add the shared `APP_URL` constant

**Files:**
- Create: `apps/web/lib/app-url.ts`

- [ ] **Step 1: Write the constant**

```ts
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://app.coffeesnobproject.com";

export const APP_SIGN_UP_URL = `${APP_URL}/sign-up`;
export const APP_SIGN_IN_URL = `${APP_URL}/sign-in`;
```

- [ ] **Step 2: Add the optional override to env files (documentation only, no secret involved)**

Append to `apps/web/.env.example` if that file exists (check first with `ls apps/web/.env.example`); if it doesn't exist, skip this step — don't create a new env-file convention for one optional var.

```
NEXT_PUBLIC_APP_URL=https://app.coffeesnobproject.com
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && npx tsc --noEmit -p .
```

Expected: no errors (this file has no consumers yet — that's fine, later tasks import it).

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/app-url.ts
git commit -m "Add shared APP_URL constant for the deployed app's sign-in/sign-up links"
```

---

### Task 3: Site-wide scroll-reveal infrastructure

**Files:**
- Create: `apps/web/components/scroll-reveal.tsx`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Write the observer component**

```tsx
"use client";

import { useEffect } from "react";

const SELECTOR = "[data-reveal], [data-reveal-hair], .band-fade, .scale-chevrons";

export function ScrollReveal() {
  useEffect(() => {
    const targets = document.querySelectorAll(SELECTOR);
    if (targets.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.35 }
    );

    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return null;
}
```

Save as `apps/web/components/scroll-reveal.tsx`.

- [ ] **Step 2: Mount it once in the root layout**

In `apps/web/app/layout.tsx`, add the import and render `<ScrollReveal />` as the first child of `<body>`:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { ScrollReveal } from "@/components/scroll-reveal";

export const metadata: Metadata = {
  title: "Coffee Snob — Find coffee worth the detour",
  description:
    "A curated guide to specialty coffee, city by city. Five to ten shops per city, chosen against written standards, not crowdsourced ratings.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ScrollReveal />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Add the motion CSS**

Append to `apps/web/app/globals.css`:

```css
/* ── Scroll reveal ── */
[data-reveal]{opacity:0;transform:translateY(18px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1)}
[data-reveal].is-in{opacity:1;transform:translateY(0)}

[data-reveal-hair]{position:relative}
[data-reveal-hair]::after{content:'';position:absolute;inset:0;background:var(--burnt);transform:scaleX(0);transform-origin:left;transition:transform .9s cubic-bezier(.16,1,.3,1)}
[data-reveal-hair].is-in::after{transform:scaleX(1)}

.band-fade{background:var(--paper);transition:background-color 1.1s cubic-bezier(.16,1,.3,1)}
.band-fade.is-in{background:var(--oxblood)}
.band-fade [data-reveal]{transition-delay:.25s}

.scale-chevrons svg{opacity:0;transition:opacity .4s ease-out}
.scale-chevrons.is-in svg{opacity:var(--fill-opacity)}
.scale-chevrons.is-in svg:nth-child(1){transition-delay:0s}
.scale-chevrons.is-in svg:nth-child(2){transition-delay:.12s}
.scale-chevrons.is-in svg:nth-child(3){transition-delay:.24s}
.scale-chevrons.is-in svg:nth-child(4){transition-delay:.36s}
.scale-chevrons.is-in svg:nth-child(5){transition-delay:.48s}

@media(prefers-reduced-motion:reduce){
  [data-reveal],[data-reveal-hair]::after,.band-fade,.scale-chevrons svg{transition-duration:.01ms!important;transform:none!important;opacity:1!important}
  .scale-chevrons svg{opacity:var(--fill-opacity)!important}
}
```

- [ ] **Step 4: Typecheck and lint**

```bash
cd apps/web && npx tsc --noEmit -p . && npx turbo run lint --filter=web
```

Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/scroll-reveal.tsx apps/web/app/layout.tsx apps/web/app/globals.css
git commit -m "Add site-wide scroll-reveal infrastructure (hairline draw, band fade, chevron stagger)"
```

---

### Task 4: Wire the hairline-draw motion into `Eyebrow`

**Files:**
- Modify: `apps/web/components/primitives.tsx`

- [ ] **Step 1: Add `data-reveal-hair` to `Eyebrow`'s rule line**

In `apps/web/components/primitives.tsx`, find `Eyebrow` (currently renders `<span style={{ flex: 1, height: 1, background: "var(--rule)" }} />` for the rule). Change that span to:

```tsx
{rule && <span data-reveal-hair style={{ flex: 1, height: 1, background: "var(--rule)" }} />}
```

This is the only change `Eyebrow` needs — every section that uses `Eyebrow` (Scale, Guides, the repurposed "Get the app" section, etc.) automatically gets the hairline-draw motion.

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit -p .
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/primitives.tsx
git commit -m "Add hairline-draw motion to Eyebrow's rule line"
```

---

### Task 5: Redesign the homepage — Hero, Scale motion, Journal removal, GetTheApp, Doors, composition

This is the largest task — it touches `page.tsx` and `web-chrome.tsx` together deliberately, so the typecheck at the end reflects a real, complete state rather than a deliberately-broken intermediate one.

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/components/web-chrome.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Rewrite `Hero`** (in `apps/web/app/page.tsx`)

Replace the current `Hero` function (imports `SignupForm`, renders the newsletter pitch) with:

```tsx
function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-type">
        <div className="hero-eyebrow">
          <span className="label">Pre-launch</span>
        </div>
        <h1 className="h1">Find coffee<br />worth the <em>detour</em></h1>
        <div className="hero-sub">
          <p className="lede" data-reveal>Log what you drink. Rate it on the only scale that matters. Build a profile before the app even ships.</p>
          <Link href={APP_SIGN_UP_URL} className="btn btn-ox" data-reveal>Create your account</Link>
          <p className="fine" data-reveal>Free. Takes about a minute.</p>
        </div>
      </div>
      <div className="hero-art">
        <div className="photo-ph" data-label="Hero photograph — a counter, mid-service, shot from the customer side" />
      </div>
    </section>
  );
}
```

Note: `hero-eyebrow` no longer has the "Letter № 001 — Sunday" half or the `.hair` divider — it was two labels joined by a rule specifically to reference the letter, which is gone. A single label reads cleaner than a rule connecting to nothing.

- [ ] **Step 2: Update the import line**

Remove `SignupForm` from the import (no longer used in `Hero`; still used in `GetTheApp`, so keep the import for `@/components/signup-form` — just drop the now-unused `Link` concerns; `Link` is already imported). Add the new import:

```tsx
import { APP_SIGN_UP_URL } from "@/lib/app-url";
```

- [ ] **Step 3: Add the chevron-fill motion to `Scale`**

In `Scale()`, find the chevron rendering:

```tsx
<span className="scale-chevrons" aria-hidden="true">
  {[0, 1, 2, 3, 4].map((n) => (
    <svg key={n} width="10" height="13" viewBox="0 0 9 11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity={n <= i ? 1 : 0.3}>
      <path d="M1.5 1.5 6 5.5l-4.5 4" />
    </svg>
  ))}
</span>
```

Replace with:

```tsx
<span className="scale-chevrons" aria-hidden="true">
  {[0, 1, 2, 3, 4].map((n) => (
    <svg key={n} width="10" height="13" viewBox="0 0 9 11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ "--fill-opacity": n <= i ? 1 : 0.3 } as React.CSSProperties}>
      <path d="M1.5 1.5 6 5.5l-4.5 4" />
    </svg>
  ))}
</span>
```

(Opacity now comes from the CSS variable + the `.scale-chevrons.is-in` rule added in Task 3, instead of an inline `opacity` prop — same visual end state, now animatable.)

- [ ] **Step 4: Add a door-3 CTA to `Guides`**

In `Guides()`, the section header currently has a "See all" link (`<Link href="/city-guides" className="seeall label-lg">All city guides →</Link>`) — leave that as-is, it already serves as door 3's CTA. No change needed here beyond confirming it stays; **do not duplicate a second button**.

- [ ] **Step 5: Remove the `Journal` section from the homepage**

Delete the `Journal()` function entirely and the now-unused import `getAllJournalPosts` from the top of the file. Its call site (`<Journal />`) is removed in Step 9's composition rewrite below.

- [ ] **Step 6: Rename and rewrite `AppComingSoon` to `GetTheApp`**

Replace:

```tsx
function AppComingSoon() {
  return (
    <section style={{ background: "var(--oxblood)", color: "var(--cream)", padding: "96px 0 100px" }}>
      <div className="wrap letter-in">
        <div>
          <Eyebrow color="rgba(233,228,208,.5)">The app</Eyebrow>
          <h2 className="h2" style={{ marginTop: 18 }}>Built for<br />wherever you land.</h2>
        </div>
        <div style={{ display: "grid", gap: 26 }}>
          <p className="lede on-dark">The locator is in build — city guides, the detour scale, saved lists, all of it. No download link yet because there&rsquo;s nothing to download yet. The letter is how you&rsquo;ll know the day it&rsquo;s ready.</p>
          <SignupForm dark done={["You'll hear it from us first", "No spam between now and launch — just the Sunday letter."]} />
        </div>
      </div>
    </section>
  );
}
```

with:

```tsx
function GetTheApp() {
  return (
    <section id="get-the-app" className="band-fade" style={{ color: "var(--cream)", padding: "96px 0 100px" }}>
      <div className="wrap letter-in">
        <div>
          <Eyebrow color="rgba(233,228,208,.5)">The app</Eyebrow>
          <h2 className="h2" style={{ marginTop: 18 }}>Built for<br />wherever you land.</h2>
        </div>
        <div style={{ display: "grid", gap: 26 }}>
          <p className="lede on-dark" data-reveal>Streaks, saved lists, and a push alert the moment we map a new city — that experience is native-only. Join the list and you&rsquo;ll be first to know when it&rsquo;s ready.</p>
          <SignupForm dark done={["You're on the list", "We'll email you the moment the app is ready to install."]} />
        </div>
      </div>
    </section>
  );
}
```

Note `background: "var(--oxblood)"` moved out of the inline `style` — the `.band-fade` class (defined in Task 3, Step 3) already owns the full background transition (`var(--paper)` → `var(--oxblood)` via `.is-in`); nothing further to reconcile here.

- [ ] **Step 7: Delete `LetterBand`, add `Doors`** (in `apps/web/components/web-chrome.tsx`)

Delete the `LetterBand` function entirely. Add in its place:

```tsx
export function Doors() {
  return (
    <section className="doors">
      <div className="door ox">
        <span className="label">Do this now</span>
        <h3 className="d3">Log what you drink</h3>
        <Link href={APP_SIGN_UP_URL} className="btn" style={{ background: "var(--cream)", color: "var(--ink)", marginTop: 14 }}>Create your account</Link>
      </div>
      <div className="door">
        <span className="label">Coming to your phone</span>
        <h3 className="d3">Get the app</h3>
        <Link href="#get-the-app" className="btn btn-line" style={{ marginTop: 14 }}>Join the waitlist</Link>
      </div>
      <div className="door cr">
        <span className="label">No account needed</span>
        <h3 className="d3">Browse the guides</h3>
        <Link href="/city-guides" className="btn btn-line" style={{ marginTop: 14 }}>City guides →</Link>
      </div>
    </section>
  );
}
```

Add the import at the top of the file:

```tsx
import { APP_SIGN_UP_URL } from "@/lib/app-url";
```

- [ ] **Step 8: Delete the `.letter*` CSS block, add `.doors` CSS**

In `apps/web/app/globals.css`, find this exact block (currently the "── Signup ──" section's neighbor) and delete it in full:

```css
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
```

Replace it with:

```css
/* ── Doors (closing recap strip) ── */
.doors{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.door{padding:40px 32px}
.door:not(:last-child){border-right:1px solid var(--rule)}
.door.ox{background:var(--oxblood);color:var(--cream)}
.door.ox .label{color:rgba(233,228,208,.5)}
.door.cr{background:var(--cream)}
.door .d3{margin-top:8px}
```

- [ ] **Step 9: Fix the two mobile-breakpoint rules that referenced `.letter`**

`.letter-in` was sharing a media-query line with `.post-in` (the journal-post body grid, unrelated and still needed — **do not delete `.post-in`**). In the `@media(max-width:900px){...}` block, find:

```css
  .letter-in,.post-in{grid-template-columns:1fr}
```

Replace with:

```css
  .post-in{grid-template-columns:1fr}
  .doors{grid-template-columns:1fr}
  .door:not(:last-child){border-right:none;border-bottom:1px solid var(--rule)}
```

In the `@media(max-width:640px){...}` block, find and delete this line entirely (nothing replaces it — `.doors` needs no separate treatment at this narrower breakpoint):

```css
  .letter{padding:64px 0 72px}
```

- [ ] **Step 10: Rewrite the homepage composition** (in `apps/web/app/page.tsx`)

In `apps/web/app/page.tsx`, update imports:

```tsx
import Link from "next/link";
import { Eyebrow, DETOUR, DETOUR_SUB } from "@/components/primitives";
import { WebNav, Doors, WebFooter } from "@/components/web-chrome";
import { SignupForm } from "@/components/signup-form";
import { getSupabase } from "@/lib/supabase";
import { getCitiesWithShopCounts } from "@coffeesnob/supabase";
import { APP_SIGN_UP_URL } from "@/lib/app-url";
```

(`getAllJournalPosts` import removed per Step 5 above.)

Update the default export:

```tsx
export default async function LandingPage() {
  const supabase = getSupabase();
  const cities = await getCitiesWithShopCounts(supabase);

  return (
    <div className="snob-web">
      <WebNav />
      <main>
        <Hero />
        <CityBand cities={cities} />
        <Scale />
        <Guides cities={cities} />
        <GetTheApp />
      </main>
      <Doors />
      <WebFooter />
    </div>
  );
}
```

- [ ] **Step 11: Typecheck and lint**

```bash
cd apps/web && npx tsc --noEmit -p . && npx turbo run lint --filter=web
```

Expected: both clean. If `tsc` complains about unused `Eyebrow`/`DETOUR`/`DETOUR_SUB` imports, they're still used inside `Scale()` — leave them; if it complains about something else, read the error, it likely means a step above was skipped.

- [ ] **Step 12: Commit**

```bash
git add apps/web/components/web-chrome.tsx apps/web/app/page.tsx apps/web/app/globals.css
git commit -m "Replace newsletter hero/letter band with three-door accounts-first homepage"
```

---

### Task 6: Update nav — real "Sign in" link, new CTA

**Files:**
- Modify: `apps/web/components/web-chrome.tsx`

- [ ] **Step 1: Update `WebNav`**

Replace:

```tsx
<div className="nav-right">
  <a href="#letter" className="btn btn-bu nav-cta">Get the letter</a>
</div>
```

with:

```tsx
<div className="nav-right">
  <a href={APP_SIGN_IN_URL} className="nav-sign">Sign in</a>
  <a href={APP_SIGN_UP_URL} className="btn btn-bu nav-cta">Create account</a>
</div>
```

Update the import to include both:

```tsx
import { APP_SIGN_UP_URL, APP_SIGN_IN_URL } from "@/lib/app-url";
```

- [ ] **Step 2: Restore the `.nav-sign` CSS rule removed in the prior dead-links pass**

In `apps/web/app/globals.css`, `.nav-links a{...}` currently no longer includes `.nav-sign` (it was removed when "Sign in" had nowhere to go). Change:

```css
.nav-links a{font-family:'Area Extended','Area',sans-serif;font-weight:700;text-transform:uppercase;font-size:9.5px;letter-spacing:.13em;color:var(--ink-2)}
.nav-links a:hover{color:var(--burnt)}
```

back to:

```css
.nav-links a,.nav-sign{font-family:'Area Extended','Area',sans-serif;font-weight:700;text-transform:uppercase;font-size:9.5px;letter-spacing:.13em;color:var(--ink-2)}
.nav-links a:hover,.nav-sign:hover{color:var(--burnt)}
```

Also restore it in the mobile drawer actions (`apps/web/components/mobile-nav.tsx`):

```tsx
<div className="nav-drawer-actions">
  <a href={APP_SIGN_IN_URL} className="nav-sign" onClick={close}>Sign in</a>
  <a href={APP_SIGN_UP_URL} className="btn btn-bu nav-cta" onClick={close}>Create account</a>
</div>
```

`MobileNav` needs the two URLs passed as props (it doesn't import `app-url.ts` directly today, and doesn't need to — pass them from `WebNav`):

```tsx
export function MobileNav({ items, active, signInHref, signUpHref }: { items: [string, string][]; active?: string; signInHref: string; signUpHref: string }) {
```

and update its two usages of the hardcoded `"#"` accordingly. Update `WebNav`'s render of `<MobileNav />` to pass the new props:

```tsx
<MobileNav items={NAV_ITEMS} active={active} signInHref={APP_SIGN_IN_URL} signUpHref={APP_SIGN_UP_URL} />
```

Restore `.nav-drawer-actions .nav-sign{font-size:12px}` in `globals.css` too (removed in the same prior pass).

- [ ] **Step 3: Typecheck and lint**

```bash
cd apps/web && npx tsc --noEmit -p . && npx turbo run lint --filter=web
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/web-chrome.tsx apps/web/components/mobile-nav.tsx apps/web/app/globals.css
git commit -m "Restore nav Sign in link, pointed at the real deployed app"
```

---

### Task 7: Swap `LetterBand` for `Doors` on the other 4 pages

**Files:**
- Modify: `apps/web/app/city-guides/page.tsx`
- Modify: `apps/web/app/city-guides/[slug]/page.tsx`
- Modify: `apps/web/app/journal/page.tsx`
- Modify: `apps/web/app/journal/[slug]/page.tsx`

- [ ] **Step 1: City guides index**

In `apps/web/app/city-guides/page.tsx`, change the import `import { WebNav, WebFooter, LetterBand } from "@/components/web-chrome";` to `import { WebNav, WebFooter, Doors } from "@/components/web-chrome";`, and change `<LetterBand />` to `<Doors />` in the JSX.

- [ ] **Step 2: City guide detail**

Same change in `apps/web/app/city-guides/[slug]/page.tsx`.

- [ ] **Step 3: Journal index**

Same change in `apps/web/app/journal/page.tsx`.

- [ ] **Step 4: Journal post**

Same change in `apps/web/app/journal/[slug]/page.tsx`.

- [ ] **Step 5: Typecheck and lint**

```bash
cd apps/web && npx tsc --noEmit -p . && npx turbo run lint --filter=web
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/city-guides/page.tsx apps/web/app/city-guides/\[slug\]/page.tsx apps/web/app/journal/page.tsx apps/web/app/journal/\[slug\]/page.tsx
git commit -m "Replace Sunday-letter band with the three-door recap strip on all pages"
```

---

### Task 8: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Typecheck and lint the whole app**

```bash
cd apps/web && npx tsc --noEmit -p . && npx turbo run lint --filter=web
```

Expected: both clean.

- [ ] **Step 2: Start the dev server**

```bash
cd apps/web && npm run dev
```

- [ ] **Step 3: Visual check — desktop**

In a browser, load each of the 5 pages (`/`, `/city-guides`, `/city-guides/<a live slug>`, `/journal`, `/journal/<a slug, or the empty state>`). Confirm on each:
- No `LetterBand`/Sunday-letter content anywhere.
- The `Doors` strip renders correctly before the footer.
- Nav shows "Sign in" and "Create account", both pointing at `https://app.coffeesnobproject.com/...` (or the `NEXT_PUBLIC_APP_URL` override if set).
- On the homepage: hero shows the single "Create your account" CTA + kept photo; scrolling reveals the hairline draw (Eyebrow rules), the Get The App band fading from paper to oxblood with delayed text, and the Scale section's chevrons filling in sequence per row.

- [ ] **Step 4: Visual check — mobile**

Resize to ~390px width (or use the browser's device toolbar) and repeat Step 3's checks, confirming `.doors` stacks to a single column and the mobile nav drawer's "Sign in" / "Create account" both work.

- [ ] **Step 5: Reduced-motion check**

Enable "reduce motion" (macOS: System Settings → Accessibility → Display → Reduce motion; or emulate via Chrome DevTools → Rendering → `prefers-reduced-motion: reduce`). Reload the homepage and confirm all content is immediately visible with no animation — no section stuck at `opacity:0`.

- [ ] **Step 6: Confirm the deployed app links actually work**

Click "Create your account" and "Sign in" from the live dev server and confirm they land on the real, deployed sign-up/sign-in screens from Task 1 (not a 404).

- [ ] **Step 7: Stop the dev server**

```bash
pkill -f "next dev"
```

---

## Explicitly out of scope (per the design spec)

- The 5 product tab screens (map/log/lists/profile/home) inside `apps/app` — still stubs, not touched by this plan.
- Sourcing a broader, non-curated shop database.
- Journal content strategy.
