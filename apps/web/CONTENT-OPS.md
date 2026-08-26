# Content Operations

Practical checklist for adding editorial content and handling user content.
Voice/brand rules live in `PRODUCT.md` — this doc is the "how," not the
"why."

## Shop sourcing & vetting

A shop only gets added to a city guide if it clears all of these:

1. **Visited in person** (or by someone whose judgment is trusted) — no
   shop gets added off reviews or photos alone.
2. **Survives "could this describe something else?"** — if the write-up's
   claims would fit a dozen other cafes, it's not specific enough to earn a
   slot yet. Go back and find the actual detail.
3. **Fits the city's 5–10 shop cap.** Adding a shop past the cap means
   something else has to be reconsidered or cut — the list stays curated,
   never padded.
4. **Has a real answer to the effort question.** The 1–5 detour verdict
   ("Stay home" → "Catch a flight") should be a real judgment, not a
   default 3.

## Write-up template

60–90 words. Structure:

- What it is, concretely (roaster relationship, brewing method specialty,
  neighborhood role) — not "cozy" or "hidden gem."
- The one detail that couldn't describe another shop.
- Who it's for (study spot / date spot / fast-in-fast-out) if relevant —
  only if it's true, not to fill space.
- Never sell. State it, let the reader decide.

Banned words: elevate, leverage, streamline, "hidden gem," "vibe,"
"nestled," "it's not X it's Y." (Full voice rules: `PRODUCT.md`.)

## Publishing states

Per the growth-strategy spec's truthfulness constraint: nothing on the
marketing site is filler.

- A city only gets a public guide page once it has real, vetted shops on
  it — no placeholder shop cards.
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
