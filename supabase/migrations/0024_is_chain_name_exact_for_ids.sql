-- Mirror of isChain's rule in apps/web/lib/nearby-shops.ts: blocklist entries
-- with a brand ID (0023) match shop names exactly; name-only entries also match
-- as leading whole words. Stops a looked-up chain like "costa" from hiding
-- "Costa Rica Café". Same signature, so log_shop_visit and shop_ratings pick it up.
create or replace function public.is_chain_name(p_name text)
returns boolean
language sql
stable
set search_path = public
as $$
  with n as (
    select btrim(regexp_replace(
      replace(replace(
        translate(lower(coalesce(p_name, '')), 'áàâäãåéèêëíìîïóòôöõúùûüñç', 'aaaaaaeeeeiiiiooooouuuunc'),
      '''', ''), '’', ''),
      '[^a-z0-9]+', ' ', 'g')) as v
  )
  select exists (
    select 1 from public.chain_blocklist b, n
    where n.v = b.name or (b.wikidata is null and n.v like b.name || ' %')
  );
$$;
