-- Chain names in any script. The old rule turned every non-Latin letter into a
-- space, so "スターバックス" normalized to '' and non-Latin chains could never be
-- blocked (worse, the index build's copy of the rule matched every non-Latin
-- name to every other). Now only whitespace and punctuation separate words,
-- spelled out rather than a locale class so the result is the same in any
-- database locale. Mirror of normalizeChainName / NAME_SEPARATORS in
-- packages/coffee-index/src/index.ts; test/chain-twins.test.ts keeps them in step.
-- Same signature, so log_shop_visit and shop_ratings pick it up.
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
      '[\s!-/:-@\[-`{-~ ·‐-‧　-〿・！-／：-＠]+', ' ', 'g')) as v
  )
  select exists (
    select 1 from public.chain_blocklist b, n
    where n.v = b.name or (b.wikidata is null and n.v like b.name || ' %')
  );
$$;
