"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addChainBlock,
  allowChain,
  removeChainBlock,
  removePlaceOverride,
  resolvePlaceFlags,
  setChainPrefix,
  setPlaceOverride,
} from "@coffeesnob/supabase";
import { normalizeChainName } from "@coffeesnob/coffee-index";
import { getSupabaseServer } from "@/lib/supabase-server";

// Every write goes through the signed-in admin's session; RLS (is_admin())
// is the real gate. Changes reach the map within minutes (blocklist cache)
// and the index at the next monthly build.

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const isBrandId = (s: string) => /^Q\d+$/.test(s);

export async function blockChainAction(formData: FormData) {
  const name = normalizeChainName(str(formData, "chain"));
  const wikidata = str(formData, "wikidata") || null;
  if (!name) return;
  await addChainBlock(await getSupabaseServer(), name, wikidata && isBrandId(wikidata) ? wikidata : null);
  redirect(str(formData, "back") || "/admin/shops?tab=chains");
}

// A suggestion from the build: a brand ID, a "starbucks …" leftover group of
// an already-blocked chain, or a plain name.
export async function decideSuggestionAction(formData: FormData) {
  const key = str(formData, "key");
  const name = normalizeChainName(str(formData, "name").replace(/ …$/, ""));
  const decision = str(formData, "decision");
  const leftovers = str(formData, "kind") === "prefix";
  const supabase = await getSupabaseServer();
  if (leftovers) {
    if (decision === "block") await setChainPrefix(supabase, key, true);
    // Allowing leftovers needs no row: they're only suggested while the chain
    // has no prefix, so remember the call as an allowed entry for the group.
    else await allowChain(supabase, `${key} …`, null);
  } else if (decision === "block") {
    await addChainBlock(supabase, name, isBrandId(key) ? key : null);
  } else {
    await allowChain(supabase, name, isBrandId(key) ? key : null);
  }
  revalidatePath("/admin/shops");
}

export async function unblockChainAction(formData: FormData) {
  await removeChainBlock(await getSupabaseServer(), str(formData, "chain"));
  revalidatePath("/admin/shops");
}

export async function hideFlaggedPlaceAction(formData: FormData) {
  const placeId = str(formData, "placeId");
  const supabase = await getSupabaseServer();
  await setPlaceOverride(supabase, placeId, "hide", str(formData, "reason") || null);
  await resolvePlaceFlags(supabase, placeId);
  revalidatePath("/admin/shops");
}

export async function dismissFlagsAction(formData: FormData) {
  await resolvePlaceFlags(await getSupabaseServer(), str(formData, "placeId"));
  revalidatePath("/admin/shops");
}

export async function removeOverrideAction(formData: FormData) {
  await removePlaceOverride(await getSupabaseServer(), str(formData, "placeId"));
  revalidatePath("/admin/shops");
}
