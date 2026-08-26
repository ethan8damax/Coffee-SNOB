# Coffee Snob — Growth Strategy Design

Date: 2026-08-26

## Context

Following the Auth & Session sub-project (merged 2026-08-22), this session
stepped back from screen-by-screen build order to brainstorm the business and
product strategy underneath it: monetization, cost structure, the full app
feature set, marketing-site/app crossover, marketing strategy, content
moderation, and which project docs are missing. This doc is the decision
record from that brainstorm — a strategy spec, not an implementation spec.
Buildable pieces get split into their own specs/plans (see "Build sequencing"
at the end).

Brand/voice/curation context lives in `apps/web/PRODUCT.md` and `DESIGN.md`;
this doc does not duplicate it, only resolves the one place this brainstorm
put pressure on it (the affiliate/paid-placement line, below).

## Decisions

### 1. Editorial line

`PRODUCT.md` bans affiliate links and paid placement outright. Loosened,
deliberately, to a content-type gradient rather than a blanket rule:

- **City guides & shop write-ups:** zero commercial links, ever. This is the
  credibility the brand rests on — unchanged from the original rule.
- **Journal/blog posts:** affiliate links allowed where the post is genuinely
  about gear (pour-over guides, home setup roundups) — the content already
  has a commercial context, an affiliate link there isn't padding.
- **Newsletter:** affiliate mentions only when relevant to that issue's actual
  content, never a dedicated "shop" section.
- **App:** no affiliate links at all. The only outbound shop action is
  "visit shop" (maps/website link) — the app's value proposition is trust in
  curation, full stop.
- **Shop partnerships (paid placement):** a clearly labeled **Partner** tier,
  visually distinct from the curated list. Never blended into editorial
  ordering.

### 2. Revenue phasing

**Build first** (need no existing user base):
- Print-on-demand merch (Printful/Printify — no upfront inventory, per-unit
  cost only at sale).
- Journal/newsletter affiliate links (per §1's gradient).

**Defer until there's an audience or shop relationships to sell**:
- Shop partnerships (paid placement + analytics + photo gallery) — needs
  outreach and, ideally, real app traffic to point to.
- City guide magazines (print/digital coffee-table format).
- Coffee Snob+ premium tier (custom app icon, early city-guide access,
  downloadable guide PDFs — Letterboxd Pro is the reference point).

**Explicitly rejected**: third-party ads. Conflicts with the "welcoming
expert, not a magazine stuffed with banners" brand posture, and isn't worth
the revenue at this scale for years.

### 3. Feature roadmap

Already covered by the existing schema and the in-flight 9-screens plan:
city discovery, shop detail pages, personal log (5-chevron effort rating),
curated + user collections, friends graph.

**New, confirmed core-to-v1: Coffee Snob Passport.** A rewards layer over
data already captured in `logs` — cities/shops visited, streaks, badges
("5-chevron club," "10 shops in one city"), and an annual shareable
"Wrapped"-style recap. Being core-to-v1 means the schema should account for
it now (a `badges`/`achievements` table, or a materialized view over `logs`)
even though the full reward-rule set can ship after the base 9 screens —
avoids a schema migration fight later.

**Deferred, each its own future sub-project:**
- Shop-partner portal (claim shop, analytics, photo upload) — a distinct
  B2B-facing surface, not a bolt-on to the consumer app.
- Admin/CMS dashboard — manage cities/shops/lists, review flagged content,
  track partner + affiliate revenue. Real scope: an auth-gated internal tool.

### 4. Marketing site ↔ app crossover

Unchanged from the project-setup spec's architecture: city guides live in
Supabase so both the website (SEO, shareable) and the app (native reader)
read the same data; journal stays website-only (MDX), since it's the
pre-launch SEO/audience-building surface and no app screen consumes it.

Going forward: website city-guide pages get a "View in App" CTA once the app
ships; the newsletter's explicit job at launch shifts from pageviews to app
installs.

### 5. Content moderation

V1: text-only visit notes (no photo upload yet), a lightweight
profanity/slur filter on submit, and a user-facing "report" flag reviewed by
hand via Supabase directly. No moderation dashboard at this volume — that
capability is folded into the admin dashboard in §3 when it's built.

### 6. Marketing strategy — automate vs. personal

**Automatable:** SEO/evergreen journal posts (AI-drafted, human-edited for
voice), social repurposing of shop write-ups, an email welcome/drip sequence.

**Needs personal love, no way around it:** shop vetting and city-guide
curation (this *is* the product's credibility), photography, merch design,
the weekly editorial letter's voice, partner sales outreach, community
replies.

### 7. Costs

**Upfront:** Apple Developer Program ($99/yr), Google Play Developer ($25
one-time). Merch: $0 upfront (print-on-demand, per-unit cost at sale only).

**Ongoing, scales with usage:**
- Vercel: Hobby is non-commercial — once monetized, needs **Pro**
  (~$20/mo/seat) plus usage past included quotas.
- Supabase: free tier covers pre-launch (pauses when idle); **Pro**
  (~$25/mo) once it needs to stay always-on with headroom, then scales with
  DB size/bandwidth/MAU.
- Email: **Resend** — Vercel's native marketplace messaging integration,
  free to 3k emails/mo (100/day), ~$20/mo for 50k. Provision via
  `vercel integration add resend` when this is actually built, not by
  hand-wiring an SMTP client.
- SMS: skip. Supabase's SMS support is phone-auth OTP only, not marketing
  sends. Push notifications (needed for the app regardless, and free) cover
  the "stay top of mind" job without Twilio's per-message cost.
- Expo/EAS builds: free tier sufficient through most of development.

**Net estimate:** $0–20/mo pre-launch + $99/yr Apple fee. Roughly $60–90/mo
post-launch at modest scale (Vercel Pro + Supabase Pro + Resend), before any
paid marketing spend.

### 8. Project docs

Existing: `apps/web/PRODUCT.md` (brand/voice/audience/curation lens),
`apps/web/DESIGN.md`.

**New docs to add** (tracked as their own small task, not a full spec/plan
cycle — these are documentation, not code):
- `MONETIZATION.md` — captures §1–2 verbatim, so future work (human or
  agent) doesn't accidentally add an affiliate link to a city guide or blend
  a paid shop into the curated list.
- A content-ops doc — shop sourcing/vetting checklist, the write-up
  template, the moderation wordlist policy from §5.
- Root-level `CLAUDE.md` pointing at `apps/web/PRODUCT.md`, so brand-voice
  context applies repo-wide (currently only `apps/app` has a stub, and it
  only covers the Expo-version-drift warning).

## Out of scope for this doc

- The actual copy/checklist content of the new docs in §8 (write them, don't
  spec them).
- Shop-partner portal and admin dashboard designs (§3) — each gets its own
  brainstorm → spec → plan cycle when its turn comes.
- Passport's exact badge rules and recap visual design — schema
  accommodation is decided here; the reward-rule content is separate.

## Build sequencing

Decided in this session: docs (§8) first since every other sub-project below
should be built against them, not around them. Sequencing beyond that is the
subject of the follow-up brainstorm on finishing the build.
