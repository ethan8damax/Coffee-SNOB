# Monetization

Decision record: `docs/superpowers/specs/2026-08-26-growth-strategy-design.md`.
This file is the quick-reference version — check the spec for the reasoning.

## The editorial line

- **City guides & shop write-ups:** zero commercial links, ever. No
  affiliate links, no paid placement blended into the curated list. This is
  non-negotiable — it's the credibility the brand rests on.
- **Journal/blog posts:** affiliate links allowed when the post is genuinely
  about gear (pour-over guides, home setup roundups). The commercial context
  already exists in that content; a link there isn't padding.
- **Newsletter:** affiliate mentions only when relevant to that issue's
  actual content. Never a dedicated "shop" section.
- **App:** no affiliate links anywhere. The only outbound shop action is
  "visit shop" (maps/website link).
- **Shop partnerships:** a clearly labeled "Partner" tier, visually distinct
  from the curated list. Never blended into editorial ordering.

Before adding any commercial link or paid placement anywhere in this repo,
check which content type it's going into against the list above.

## Revenue phasing

**Building now:**
- Print-on-demand merch (Printful/Printify — no upfront inventory).
- Journal/newsletter affiliate links (per the editorial line above).

**Deferred until there's an audience or shop relationships:**
- Shop partnerships (paid placement + analytics + photo gallery).
- City guide magazines (print/digital coffee-table format).
- Coffee Snob+ premium tier (custom app icon, early city-guide access,
  downloadable guide PDFs).

**Explicitly rejected:** third-party ads.

## Costs

- Upfront: Apple Developer Program ($99/yr), Google Play Developer ($25
  one-time).
- Ongoing pre-launch: $0–20/mo (free tiers on Vercel/Supabase/Resend).
- Ongoing post-launch (modest scale): ~$60–90/mo (Vercel Pro + Supabase Pro
  + Resend), before any paid marketing spend.
- SMS is explicitly skipped in favor of push notifications.
