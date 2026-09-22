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

## Commerce architecture: merch vs. gear (decided 2026-08-27)

These need different architectures — don't conflate them.

- **Merch (stickers, shirts, hats, sweatshirts) — our own product.** Full
  on-site storefront, real cart/checkout on coffeesnobproject.com, nobody
  redirected out. Fulfillment is print-on-demand (Printful/Printify —
  produced and shipped per order, nothing held in inventory). **Platform
  (revised 2026-09-22): custom-built**, not Shopify — reversed from the
  original 2026-08-27 decision below. Catalog-only admin shell spec'd in
  `docs/superpowers/specs/2026-09-22-admin-merch-shell-design.md`;
  cart/checkout/payment architecture is a separate decision, not made yet.
  Payment handling is not a place to under-build — pick that architecture
  deliberately when checkout is actually scoped, don't default to hand-rolling
  it just because Shopify was ruled out.
- **Gear (grinders, Chemex, Aeropress, other brands' hardware) — not our
  product, status: paused.** Considered and explicitly rejected becoming a
  reseller/dropshipper of third-party gear for now: premium brands (Fellow,
  Acaia, Baratza, etc.) require a formal authorized-dealer application per
  brand, often with minimum order commitments — real business development
  that doesn't fit a pre-launch, no-audience-yet stage. Traffic is the
  leverage that makes that conversation viable later, not something to
  chase before it exists. **Decision paused pending a conversation with
  Ryan** — no design or build work should start on a gear storefront or
  gear affiliate links until that's resolved.
- **Beans** are a separate, more promising near-term case than generic gear
  — a curated bean subscription built on the same roaster relationships
  already being vetted for city guides (per `CURATION-STANDARDS.md`) is a
  more natural fit than dropshipping hardware. Not decided or scoped yet;
  revisit as its own brainstorm.

## Costs

- Upfront: Apple Developer Program ($99/yr), Google Play Developer ($25
  one-time).
- Ongoing pre-launch: $0–20/mo (free tiers on Vercel/Supabase/Resend).
- Ongoing post-launch (modest scale): ~$60–90/mo (Vercel Pro + Supabase Pro
  + Resend), before any paid marketing spend.
- SMS is explicitly skipped in favor of push notifications.
