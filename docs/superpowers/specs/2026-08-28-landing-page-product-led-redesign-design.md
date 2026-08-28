# Marketing Site — Product-Led Landing Page Redesign

Date: 2026-08-28

## Context

The current homepage (`apps/web/app/page.tsx`) is a pre-launch lead-gen
page: hero pitches a weekly newsletter, primary CTA is "Get the letter,"
and the rest of the page (city band, Detour scale, city guides preview,
journal preview, "the app is coming" band, letter band) all funnel toward
the same email signup.

Reference: [fable.co](https://fable.co) — every section's CTA is "Get the
app," each feature block shows a real phone-frame screenshot of the actual
live app (not an illustration), and the page's entire job is proving the
product is real and pointing people at it. The user wants Coffee Snob's
site to work the same way, eventually — but two things are true today that
weren't true for Fable:

1. **No app-store presence exists yet.** Confirmed: no `eas.json`, no iOS
   bundle identifier, no Android package name in `apps/app/app.json`.
   Nothing is submittable today, so a literal "Get the app" store-link
   button isn't buildable yet.
2. **Accounts already work; the product screens don't.** `apps/app`'s
   `(auth)` and `(onboarding)` route groups are fully built and wired to
   Supabase (sign up, sign in, forgot/reset password, email confirmation,
   identity + taste onboarding). The five product tab screens (home, map,
   log, lists, profile) are 9–21 line stubs — this is the "9 product
   screens" work flagged as next-up in prior planning, never started.
   `apps/app` already targets web via Expo Router + `react-native-web`
   (`build:web` script, a prior export sitting in `apps/app/dist/`) — so
   "the web version" is the same codebase as the phone app, not a second
   product to design.

Given that, this redesign is explicitly a **transitional** state: it
replaces the newsletter-first framing with an accounts-first, three-path
framing, using what's real today (auth/onboarding, city guides content)
rather than pretending the full product exists.

## Decisions

**The weekly Sunday letter is cut from the site entirely** — hero, the
dedicated letter band, and its framing inside the "app is coming" section.
Email collection continues, but through account creation and the app
waitlist instead; those addresses can be repurposed for newsletter/push
later if that's ever revived. `apps/web/components/signup-form.tsx` and its
Resend backend are reused as-is for waitlist capture — only the copy and
framing around it change, not the mechanism.

**Three CTAs, not one**, reflecting three real, different things a visitor
can do right now:

1. **Log what you drink / create an account** — the primary door. Routes to
   real, working auth + onboarding.
2. **Get the app** — waitlist capture (email, via the existing signup
   form/Resend), framed honestly as "native app in build," not a store
   link.
3. **Browse the guides** — the already-real, no-account-needed city guides
   content.

## Hero

Keeps the current two-column grid (headline/copy left, photo right) rather
than Fable's single-CTA-dead-center or a three-panel hero — the photo stays
because it's already part of the brand's visual language and the user
wants it kept.

- Left column: kicker ("Pre-launch"), the locked H1 ("Find coffee worth the
  detour"), a new lede pitching the log/rate/profile action, one dominant
  CTA button ("Create your account"), and a one-line micro-copy ("Free.
  Takes about a minute.").
- Right column: unchanged — the existing photo placeholder treatment
  ("Photo coming soon," per the a11y fix already shipped).
- The other two doors (app waitlist, city guides) are **not** crammed into
  the hero — they get their own sections further down the page, plus one
  more combined appearance at the bottom.

## Page flow (replaces the current section order)

1. **Hero** (above)
2. **City band** — unchanged, the "mapped at launch" strip.
3. **The Detour scale** — unchanged content. Now sits right after the ask
   to rate, so it doubles as "here's how" instead of pure brand explainer.
4. **City guides** — the existing preview grid, promoted to a real section
   in its own right (door 3: browse).
5. **Get the app** — the existing "Built for wherever you land" oxblood
   band, repurposed as the honest waitlist section (door 2). Copy should
   name what's native-only (streaks, push, saved lists) rather than
   vaguely gesture at "the app."
6. ~~Journal preview~~ — stays out of the homepage flow; the journal
   section already returns `null` when there are no published posts (all 7
   are still drafts), and that's staying that way until there's a content
   strategy (separate, already-deferred decision — see
   `project_marketing_site_quality_audit` memory).
7. **Closing recap strip** — all three doors again, side by side, in the
   slot where the Sunday letter band used to sit, right before the footer.

## Motion

Scroll-triggered reveals via `IntersectionObserver`, each tied to
something already in the design system rather than a generic fade-up —
validated live in the visual companion before write-up. All use
ease-out-expo timing (`cubic-bezier(.16,1,.3,1)`), no bounce/elastic, and
fall back to an instant, transform-free state under
`prefers-reduced-motion: reduce`, per the brand register's motion rules.

- **Hairline rules draw themselves.** The system's existing 1px `--rule`
  dividers currently just appear. On scroll-into-view, a burnt overlay
  scales in from `transform: scaleX(0)` to `scaleX(1)`, left-to-right —
  same divider, now with a beat of motion that reads as "a line being
  drawn."
- **Color bands fade in, not wipe.** The oxblood/burnt full-bleed bands
  (already how the system marks a zone transition — city strip → scale →
  paper again) transition `background-color` directly from `--paper` to
  `--oxblood` over ~1.1s, rather than a static cut or a wipe/reveal
  animation. Text inside the band uses the same fade+rise as everything
  else, delayed ~0.25s behind the background so it's never read against a
  background that's still shifting color underneath it.
- **The Detour chevrons fill in sequence.** In the Scale section, each of
  the five chevron strokes goes from 25% to 100% opacity with a ~0.12s
  stagger between them as the row scrolls into view — the rating "counting
  up" the way you'd read it left to right. Reserved for the Scale section
  specifically; this is the one motion moment that's brand-specific rather
  than a reusable pattern, and shouldn't be copied onto every rating
  display site-wide.

## Nav

`WebNav`'s "Sign in" link was cut in the prior dead-links pass because it
pointed at `#` with nothing behind it. Now that account creation is the
page's central action, nav should carry a real "Sign in" link again,
pointing at the same auth destination as the hero CTA (sign-in variant,
not sign-up). This falls out of the redesign rather than needing a
separate decision.

## Explicitly out of scope for this spec

- **Where the account/auth flow is actually hosted.** `apps/app`'s web
  export needs a real, reachable URL (e.g. a subdomain) before "Create
  your account" can link anywhere real. That's the first task of the
  upcoming app-build phase, not this spec — this page's CTAs are being
  designed now, wired up once that exists.
- **Sourcing a broader, non-curated shop database.** For "log what you
  drink" to be meaningful on day one, the map needs more than the 5–10
  Snob-approved shops per city. Discussed and validated as directionally
  right (same shape as Beli/Untappd: log anything, curation is a badge on
  top), with one hard guardrail carried forward — **individual users can
  rate on the Detour scale personally, but the app must never show an
  aggregated numeric/star score for the non-curated layer.** The No-Number
  Rule (`apps/web/DESIGN.md`) is brand identity, not a styling choice, and
  a crowdsourced average is exactly what it exists to prevent. Data
  source (Google Places API vs. OSM vs. user-submitted-only), schema
  changes, and map/log screen design are app-build work, to be scoped when
  that phase starts.
- **Journal content strategy** — already deferred, unchanged by this spec.
- **Building the actual product screens (map/log/lists/profile).**

## Testing

Standard for a marketing-site content/layout change: typecheck, lint,
visual check in-browser (desktop + mobile) before merging, same as the
prior audit-fix passes. No new logic being introduced — this is markup,
copy, and CSS section reordering plus repurposing the existing signup-form
component with new copy.
