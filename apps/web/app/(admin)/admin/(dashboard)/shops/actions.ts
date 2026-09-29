"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addChainBlock,
  addCurationVisit,
  addRoaster,
  addStockists,
  markShopOpen,
  setShopClosed,
  pinStockist,
  removeRoaster,
  removeStockist,
  rejectShopPromotion,
  removeCurationVisit,
  allowChain,
  removeChainBlock,
  removePlaceOverride,
  resolvePlaceFlags,
  setChainPrefix,
  setPlaceOverride,
  approveSubmission,
  declineSubmission,
  submitShop,
} from "@coffeesnob/supabase";
import { normalizeChainName, parseStockists } from "@coffeesnob/coffee-index";
import { getSupabaseServer } from "@/lib/supabase-server";
import { parseLatLng } from "@/lib/lat-lng";
import { toLocality, toStreetAddress, type PhotonFeature } from "@/lib/photon";

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

export async function addVisitAction(formData: FormData) {
  const visitedOn = str(formData, "visitedOn");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visitedOn)) return;
  await addCurationVisit(await getSupabaseServer(), str(formData, "shopId"), visitedOn, str(formData, "notes") || null);
  revalidatePath("/admin/shops");
}

export async function removeVisitAction(formData: FormData) {
  await removeCurationVisit(await getSupabaseServer(), str(formData, "visitId"));
  revalidatePath("/admin/shops");
}

// "Not a fit": the clout trigger never flags this shop again.
export async function rejectLeadAction(formData: FormData) {
  await rejectShopPromotion(await getSupabaseServer(), str(formData, "id"));
  revalidatePath("/admin/shops");
}

// ── Roasters (Phase 5): matches show up after the next monthly build ────
const website = (s: string) => (!s ? null : /^https?:\/\//i.test(s) ? s : `https://${s}`);

export async function addRoasterAction(formData: FormData) {
  const name = str(formData, "name");
  if (!name) return;
  const country = str(formData, "countryCode").toUpperCase();
  const id = await addRoaster(await getSupabaseServer(), {
    name,
    website: website(str(formData, "website")),
    countryCode: /^[A-Z]{2}$/.test(country) ? country : null,
    notes: str(formData, "notes") || null,
  });
  redirect(`/admin/shops?tab=roasters&roaster=${id}`);
}

export async function removeRoasterAction(formData: FormData) {
  await removeRoaster(await getSupabaseServer(), str(formData, "roasterId"));
  redirect("/admin/shops?tab=roasters");
}

export async function addStockistsAction(formData: FormData) {
  await addStockists(await getSupabaseServer(), str(formData, "roasterId"), parseStockists(String(formData.get("lines") ?? "")));
  revalidatePath("/admin/shops");
}

export async function pinStockistAction(formData: FormData) {
  const placeId = str(formData, "placeId");
  await pinStockist(await getSupabaseServer(), str(formData, "stockistId"), /^cs_[0-9a-f]{12}$/.test(placeId) ? placeId : null);
  revalidatePath("/admin/shops");
}

export async function removeStockistAction(formData: FormData) {
  await removeStockist(await getSupabaseServer(), str(formData, "stockistId"));
  revalidatePath("/admin/shops");
}

// ── Possibly closed (Phase 6) ───────────────────────────────────────────
export async function closeShopAction(formData: FormData) {
  await setShopClosed(await getSupabaseServer(), str(formData, "shopId"), true);
  revalidatePath("/admin/shops");
}

export async function reopenShopAction(formData: FormData) {
  await setShopClosed(await getSupabaseServer(), str(formData, "shopId"), false);
  revalidatePath("/admin/shops");
}

export async function stillOpenAction(formData: FormData) {
  await markShopOpen(await getSupabaseServer(), str(formData, "shopId"));
  revalidatePath("/admin/shops");
}

// ── Add a shop (0036) ──────────────────────────────────────────────────

const ADDED = "/admin/shops?tab=added";

export async function approveSubmissionAction(formData: FormData) {
  const at = parseLatLng(str(formData, "latLng"));
  if (!at) redirect(`${ADDED}&sub=${str(formData, "id")}&error=spot`);
  await approveSubmission(await getSupabaseServer(), str(formData, "id"), {
    name: str(formData, "name"),
    lat: at.lat,
    lng: at.lng,
    address: str(formData, "address"),
    hours: str(formData, "hours"),
    website: str(formData, "website"),
  });
  revalidatePath("/admin/shops");
  redirect(`${ADDED}&done=approved`);
}

export async function declineSubmissionAction(formData: FormData) {
  await declineSubmission(await getSupabaseServer(), str(formData, "id"), str(formData, "reason"));
  revalidatePath("/admin/shops");
  redirect(`${ADDED}&done=declined`);
}

// The spot's city (for its city page) and street, as /api/locate does.
async function reverse(lat: number, lng: number) {
  try {
    const params = new URLSearchParams({ lat: lat.toFixed(5), lon: lng.toFixed(5), lang: "en" });
    const res = await fetch(`https://photon.komoot.io/reverse?${params}`, {
      headers: { "User-Agent": "coffeesnob.app admin (https://coffeesnob.app)" },
      signal: AbortSignal.timeout(5000),
    });
    const { features } = (await res.json()) as { features: PhotonFeature[] };
    return { ...toLocality(features[0]), address: toStreetAddress(features[0]) };
  } catch {
    return { locality: null, region: null, countryCode: null, address: null };
  }
}

// An admin's own add goes live at once (submit_shop skips the queue for admins).
export async function adminAddShopAction(formData: FormData) {
  const name = str(formData, "name");
  const at = parseLatLng(str(formData, "latLng"));
  if (!at || name.length < 2) redirect(`${ADDED}&error=${at ? "name" : "spot"}`);
  const place = await reverse(at.lat, at.lng);
  try {
    await submitShop(await getSupabaseServer(), {
      name,
      lat: at.lat,
      lng: at.lng,
      address: str(formData, "address") || place.address,
      website: str(formData, "website"),
      hours: str(formData, "hours"),
      locality: place.locality,
      region: place.region,
      countryCode: place.countryCode,
    });
  } catch (e) {
    redirect(`${ADDED}&error=${/chain/i.test(String((e as Error).message)) ? "chain" : "save"}`);
  }
  revalidatePath("/admin/shops");
  redirect(`${ADDED}&done=added`);
}
