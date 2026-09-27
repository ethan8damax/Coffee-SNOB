import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

type Client = SupabaseClient<Database>;

export type CollectionSummary = {
  id: string; title: string; description: string | null; isPublic: boolean; saveCount: number;
  ownerId: string | null; shopCount: number; createdAt: string;
};
export type CollectionItem = { shopId: string; name: string; neighborhood: string | null; locality: string | null; note: string | null; lat: number | null; lng: number | null; rated: boolean };
export type Collection = CollectionSummary & { ownerUsername: string | null; items: CollectionItem[] };
export type TopShop = { slot: number; shopId: string; name: string };

const SUMMARY = "id, title, description, is_public, save_count, curator_id, created_at, list_items(count)";

export function toCollectionSummary(r: {
  id: string; title: string; description: string | null; is_public: boolean; save_count: number;
  curator_id: string | null; created_at: string; list_items: { count: number }[];
}): CollectionSummary {
  return {
    id: r.id, title: r.title, description: r.description, isPublic: r.is_public, saveCount: r.save_count,
    ownerId: r.curator_id, shopCount: r.list_items[0]?.count ?? 0, createdAt: r.created_at,
  };
}

// A person's collections. RLS hides private ones from everyone but them.
export async function getUserCollections(client: Client, userId: string): Promise<CollectionSummary[]> {
  const { data, error } = await client.from("lists").select(SUMMARY).eq("type", "collection").eq("curator_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(toCollectionSummary);
}

export async function getCollection(client: Client, id: string): Promise<Collection | null> {
  const { data, error } = await client
    .from("lists")
    .select(`${SUMMARY}, items:list_items(shop_id, note, position, shops(name, neighborhood, locality, lat, lng))`)
    .eq("id", id)
    .eq("type", "collection")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const items = [...data.items].sort((a, b) => a.position - b.position);
  const shopIds = items.map((i) => i.shop_id);
  // Rated = logged at least once; unrated cafés open on the map instead of a shop page.
  const { data: rated, error: ratedError } = shopIds.length
    ? await client.from("shop_ratings").select("id").in("id", shopIds)
    : { data: [], error: null };
  if (ratedError) throw ratedError;
  const ratedIds = new Set((rated ?? []).map((r) => r.id));
  // lists.curator_id points at auth.users, so the username is its own lookup.
  const owner = data.curator_id
    ? (await client.from("profiles").select("username").eq("id", data.curator_id).maybeSingle()).data
    : null;
  return {
    ...toCollectionSummary({ ...data, list_items: [{ count: items.length }] }),
    ownerUsername: owner?.username ?? null,
    items: items.map((i) => ({
      shopId: i.shop_id, note: i.note, name: i.shops?.name ?? "", neighborhood: i.shops?.neighborhood ?? null,
      locality: i.shops?.locality ?? null, lat: i.shops?.lat ?? null, lng: i.shops?.lng ?? null, rated: ratedIds.has(i.shop_id),
    })),
  };
}

export async function createCollection(client: Client, userId: string, fields: { title: string; isPublic: boolean; description?: string | null }): Promise<string> {
  const { data, error } = await client
    .from("lists")
    .insert({ type: "collection", curator_id: userId, title: fields.title.trim().slice(0, 120), is_public: fields.isPublic, description: fields.description?.trim() || null })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateCollection(client: Client, id: string, fields: { title?: string; description?: string | null; isPublic?: boolean }): Promise<void> {
  const update: { title?: string; description?: string | null; is_public?: boolean } = {};
  if (fields.title !== undefined) update.title = fields.title.trim().slice(0, 120);
  if (fields.description !== undefined) update.description = fields.description?.trim() || null;
  if (fields.isPublic !== undefined) update.is_public = fields.isPublic;
  const { error } = await client.from("lists").update(update).eq("id", id);
  if (error) throw error;
}

export async function deleteCollection(client: Client, id: string): Promise<void> {
  const { error } = await client.from("lists").delete().eq("id", id);
  if (error) throw error;
}

export async function addToCollection(client: Client, listId: string, shopId: string): Promise<void> {
  const { error } = await client.from("list_items").upsert({ list_id: listId, shop_id: shopId }, { onConflict: "list_id,shop_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeFromCollection(client: Client, listId: string, shopId: string): Promise<void> {
  const { error } = await client.from("list_items").delete().eq("list_id", listId).eq("shop_id", shopId);
  if (error) throw error;
}

export async function setCollectionNote(client: Client, listId: string, shopId: string, note: string | null): Promise<void> {
  const { error } = await client.from("list_items").update({ note: note?.trim().slice(0, 300) || null }).eq("list_id", listId).eq("shop_id", shopId);
  if (error) throw error;
}

// Which of my collections already hold this shop (for the sheet's checks).
export async function getCollectionsWithShop(client: Client, userId: string, shopId: string): Promise<string[]> {
  const { data, error } = await client.from("list_items").select("list_id, lists!inner(curator_id)").eq("shop_id", shopId).eq("lists.curator_id", userId);
  if (error) throw error;
  return data.map((r) => r.list_id);
}

// ── Saving collections (Faves) ──
export async function isCollectionSaved(client: Client, userId: string, listId: string): Promise<boolean> {
  const { data, error } = await client.from("list_saves").select("list_id").eq("user_id", userId).eq("list_id", listId).maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function setCollectionSaved(client: Client, userId: string, listId: string, saved: boolean): Promise<void> {
  const { error } = saved
    ? await client.from("list_saves").upsert({ user_id: userId, list_id: listId }, { onConflict: "user_id,list_id", ignoreDuplicates: true })
    : await client.from("list_saves").delete().eq("user_id", userId).eq("list_id", listId);
  if (error) throw error;
}

// RLS returns these only to the owner, or to anyone when their Faves are public.
export async function getSavedCollections(client: Client, userId: string): Promise<CollectionSummary[]> {
  const { data, error } = await client.from("list_saves").select(`created_at, lists(${SUMMARY})`).eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data.flatMap((r) => (r.lists ? [toCollectionSummary(r.lists)] : []));
}

export async function setFavesPublic(client: Client, userId: string, isPublic: boolean): Promise<void> {
  const { error } = await client.from("profiles").update({ faves_public: isPublic }).eq("id", userId);
  if (error) throw error;
}

// ── Top 4 ──
export async function getTopShops(client: Client, userId: string): Promise<TopShop[]> {
  const { data, error } = await client.from("profile_top_shops").select("slot, shop_id, shops(name)").eq("user_id", userId).order("slot");
  if (error) throw error;
  return data.map((r) => ({ slot: r.slot, shopId: r.shop_id, name: r.shops?.name ?? "" }));
}

// Putting a shop in a slot moves it there if it was in another slot.
export async function setTopShop(client: Client, userId: string, slot: number, shopId: string): Promise<void> {
  const del = await client.from("profile_top_shops").delete().eq("user_id", userId).or(`slot.eq.${slot},shop_id.eq.${shopId}`);
  if (del.error) throw del.error;
  const { error } = await client.from("profile_top_shops").insert({ user_id: userId, slot, shop_id: shopId });
  if (error) throw error;
}

export async function clearTopShop(client: Client, userId: string, slot: number): Promise<void> {
  const { error } = await client.from("profile_top_shops").delete().eq("user_id", userId).eq("slot", slot);
  if (error) throw error;
}

// ── Unrated cafés ──
export type PlaceRef = {
  externalId: string; name: string; lat: number; lng: number; address?: string | null; website?: string | null;
  phone?: string | null; hours?: string | null; locality?: string | null; region?: string | null; countryCode?: string | null;
  legacyIds?: string[];
};

// The shop row for a map café, created (unrated) if nobody has logged it yet.
// Older shops keep their OSM id, so those are checked first, as in logVisit.
export async function ensureShop(client: Client, p: PlaceRef): Promise<string> {
  if (p.legacyIds?.length) {
    const { data, error } = await client.from("shops").select("id").in("external_id", p.legacyIds).limit(1);
    if (error) throw error;
    if (data?.[0]) return data[0].id;
  }
  const { data, error } = await client.rpc("ensure_shop", {
    p_external_id: p.externalId, p_name: p.name, p_lat: p.lat, p_lng: p.lng,
    p_address: p.address ?? undefined, p_website: p.website ?? undefined, p_phone: p.phone ?? undefined, p_hours: p.hours ?? undefined,
    p_locality: p.locality ?? undefined, p_region: p.region ?? undefined, p_country_code: p.countryCode ?? undefined,
  });
  if (error) throw error;
  return data as string;
}
