# Admin Merch Shell Design

Date: 2026-09-22

## Context

`MONETIZATION.md` (2026-08-27) previously decided merch would run on
**Shopify** via the Vercel Marketplace `commerce` integration, specifically
to avoid hand-rolling a cart. The user has now reversed that: they want a
custom-built merch store, not Shopify. **This spec supersedes that
decision** — `MONETIZATION.md` is updated alongside this spec.

Full commerce (cart, checkout, payment, order fulfillment sync with
Printful/Printify) is not needed for v1 and is explicitly not designed
here. What's wanted now is the **shell**: enough that staff can create and
manage product listings ahead of checkout existing, so the catalog isn't
starting from zero when checkout gets built later.

## Decision: catalog-only admin, no storefront/cart/checkout yet

**Where it lives:** `apps/web/app/(admin)/admin/merch` — same route group
and pattern as the rest of the admin dashboard.

**Schema (catalog only):**

```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  price_cents integer not null,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  position integer not null default 0
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null,              -- e.g. "Medium / Oxblood"
  sku text,
  price_cents integer,              -- null = inherit product price
  created_at timestamptz not null default now()
);
```

No `orders`, `cart`, `inventory`, or fulfillment tables — there is nothing
to sell yet, so nothing to build against. RLS: writes gated by
`is_admin()`, matching every other content table; public reads only
`status = 'active'` products (same publishing-state pattern as
`cities`/`lists`/`posts`).

**Admin page:** list (status filter chips: Draft/Active/Archived),
create/edit form (name, description, price, photo upload →
`product_images`, variant rows). No public storefront page is built in
this pass — the shell is admin-only; nothing renders `products` on
`coffeesnobproject.com` yet.

## Out of scope (deliberately, this pass)

- Cart, checkout, payment processing.
- Printful/Printify fulfillment integration or sync.
- Inventory tracking (print-on-demand has none to track).
- The public-facing storefront page itself.

Building full commerce is its own sub-project once there's a real need to
sell — revisit platform choice (custom vs. a commerce platform) at that
point if the scope grows past what a hand-built cart/checkout can carry
safely (payment handling is not a place to under-build).

## MONETIZATION.md update

The "Commerce architecture: merch vs. gear" section's Shopify decision is
replaced with: merch runs on a custom-built catalog/cart/checkout,
starting with the catalog-only admin shell above; checkout/payment
architecture to be decided when that phase is built.
