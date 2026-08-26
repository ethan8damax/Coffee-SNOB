# Marketing Site — Truthful Launch Pass

Date: 2026-08-26

## Context

The marketing site (`apps/web`) is scaffolded but mixes real infrastructure
with placeholder/demo content left over from the design phase. Per the
growth-strategy spec's build sequencing (step 2) and its hard constraint —
**no filler content, ever** — this pass makes the site honest: real data
where real data exists, explicit "coming soon" everywhere it doesn't.
Content creation itself (writing real journal posts, vetting real shops) is
out of scope here; this is the infrastructure and cleanup pass that makes
the site truthful today and ready to fill in as content ships.

Findings that drove this design (verified against the current code, not
assumed):

- `apps/web/components/signup-form.tsx` is a local-state stub with no real
  request — already flagged with a `ponytail:` comment.
- The homepage's `CityBand` and `Guides` components use hardcoded city
  arrays (`US_CITIES`, `EU_CITIES`, `GUIDE_CITIES`) including cities that
  were never real launch markets (Brooklyn, Chicago, Berlin, Copenhagen,
  etc.) and a fake "+22 more." `apps/web/app/city-guides/page.tsx` already
  does this correctly (queries Supabase live) — the homepage needs to match
  that pattern.
- The 7 posts in `apps/web/content/journal/*.mdx` are confirmed placeholder
  copy from the design phase, not real reporting.
- `supabase/seed.sql` seeds a full 7-shop Lisbon city guide marked
  `status: 'demo'` — confirmed dev-only fixture data, not a real city.
- The homepage's "Why this exists" founder section is literally
  `"Placeholder — rewrite this in your own voice."`
- The hero claims `"Letter № 001 — Sunday"` — unverified; left alone pending
  confirmation, not to be treated as fact by this pass.

## Decisions

**Ship now, fill in content over time** — not held back until real content
exists (confirmed in this session). The site goes live looking sparse but
never fake.

**Remove fiction:**
- Move the 7 placeholder journal MDX files out of
  `apps/web/content/journal/` into a non-rendered reference location (e.g.
  `apps/web/content/_examples/`) — kept as a style/format reference for
  writing real posts, not deleted outright since the prose quality is worth
  keeping as a template.
- Move the Lisbon seed block in `supabase/seed.sql` into a separate
  dev-only seed file (not run against production), so production only ever
  seeds the 6 real launch cities, all `coming_soon`.

**Make the real infra real:**
- `SignupForm` posts to a new Route Handler that adds the email to a Resend
  audience (provisioned via `vercel integration add resend` when this is
  built — not hand-wired SMTP). Remove the `ponytail:` stub comment once
  live.
- Rewrite homepage `CityBand` and `Guides` to query Supabase the same way
  `city-guides/page.tsx` does — no hardcoded city lists, ever again.
- Journal index gets a real empty state ("First letter's on its way" or
  similar) instead of silently rendering nothing when there are 0 posts.
- Add an explicit "the app is coming" section on the homepage, reusing the
  same signup capture — no fake app-store badges/links.

**Founder section:** drafted with real structure (grounded in `PRODUCT.md`'s
voice and the Sofia/David avatars) but left as a clearly-marked draft for
the user to rewrite into their real personal story — this can't be
fabricated truthfully by anyone else.

**Affiliate infrastructure:** a small `<AffiliateLink>` MDX component that
renders a normal link plus an FTC-required disclosure line, so the
editorial gradient rule in `MONETIZATION.md` (journal gear posts: yes; city
guides: never) is easy to follow consistently once real affiliate programs
are joined. Signing up for an affiliate program (e.g. Amazon Associates) is
a manual account-creation step for the user, not something built here.

## Out of scope

- Writing any real journal posts or city guide content.
- Signing up for the actual affiliate program(s).
- Verifying/correcting the "Letter № 001" claim — flagged for the user to
  confirm or fix directly.
- The admin dashboard and map work (separate spec:
  `2026-08-26-map-and-admin-dashboard-design.md`) — this pass only touches
  the public-facing marketing site.
