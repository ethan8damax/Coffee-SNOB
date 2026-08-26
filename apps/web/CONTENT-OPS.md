# Content Operations

Practical checklist for adding editorial content and handling user content.

- Shop vetting standards (the non-negotiables, disqualifiers, the 5-10 rule,
  edge cases): `CURATION-STANDARDS.md`.
- How to write a shop write-up (structure, length, examples): `WRITEUP-GUIDE.md`.
- Voice/brand rules: `PRODUCT.md`.

This doc covers what those three don't: publishing states and moderation.

## Publishing states

Per the growth-strategy spec's truthfulness constraint: nothing on the
marketing site is filler.

- A city only gets a public guide page once it has real, vetted shops on
  it (i.e. shops that cleared `CURATION-STANDARDS.md`) — no placeholder
  shop cards.
- A city with guides in progress but not ready shows a "Coming soon" state
  naming the city, not a fake preview.
- The app itself shows "Coming soon" / waitlist treatment until it's
  actually launchable — never a dead download link.

## Moderation policy (v1)

- Visit notes are text-only in v1 — no photo upload yet.
- A lightweight profanity/slur filter runs on submit (wordlist-based, not a
  paid moderation API — revisit if volume justifies the cost).
- Users can report a note; reports are reviewed by hand via Supabase
  directly. No moderation dashboard yet — build one if/when volume makes
  manual review impractical (folds into the future admin/CMS dashboard
  sub-project).
