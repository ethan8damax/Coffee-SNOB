import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

type Client = SupabaseClient<Database>;

export async function getCities(client: Client) {
  const { data, error } = await client
    .from("cities")
    .select("id, slug, name, country, region, status")
    .order("name");
  if (error) throw error;
  return data;
}

export async function getCitiesWithShopCounts(client: Client) {
  const cities = await getCities(client);

  const { data: guides, error } = await client
    .from("lists")
    .select("city_id, list_items(count)")
    .eq("type", "city_guide");
  if (error) throw error;

  const shopCountByCity = new Map<string, number>();
  for (const guide of guides) {
    const count = (guide.list_items as unknown as { count: number }[])[0]?.count ?? 0;
    shopCountByCity.set(guide.city_id as string, count);
  }

  return cities.map((c) => ({ ...c, shopCount: shopCountByCity.get(c.id) ?? 0 }));
}

export async function getCityGuide(client: Client, citySlug: string) {
  const { data: city, error: cityError } = await client
    .from("cities")
    .select("id, slug, name, country, region, status")
    .eq("slug", citySlug)
    .maybeSingle();
  if (cityError) throw cityError;
  if (!city) return null;

  const { data: guide, error: guideError } = await client
    .from("lists")
    .select(
      "id, slug, title, description, body, cover_photo_alt, save_count, list_items(position, note, shops(id, name, neighborhood, shop_curations(price_tier, tag, writeup, order_note, editorial_rating)))"
    )
    .eq("type", "city_guide")
    .eq("city_id", city.id)
    .order("position", { referencedTable: "list_items" })
    .maybeSingle();
  if (guideError) throw guideError;

  return { city, guide };
}

export async function getProfile(client: Client, userId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("id, username, display_name, avatar_url, taste_picks, onboarded_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function isUsernameAvailable(client: Client, username: string, excludingUserId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", excludingUserId)
    .maybeSingle();
  if (error) throw error;
  return data === null;
}

export async function saveIdentity(
  client: Client,
  userId: string,
  params: { username: string; displayName: string }
) {
  const { error } = await client
    .from("profiles")
    .update({ username: params.username, display_name: params.displayName })
    .eq("id", userId);
  if (error) throw error;
}

export async function saveTastePicks(client: Client, userId: string, tastePicks: string[]) {
  const { error } = await client
    .from("profiles")
    .update({ taste_picks: tastePicks, onboarded_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function getRatedShopsInBounds(
  client: Client,
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }
) {
  const { data, error } = await client
    .from("shop_ratings")
    .select("id, name, lat, lng, neighborhood, is_snob_approved, tag, price_tier, rating, log_count")
    .gte("lat", bounds.minLat)
    .lte("lat", bounds.maxLat)
    .gte("lng", bounds.minLng)
    .lte("lng", bounds.maxLng);
  if (error) throw error;
  return data;
}

export async function logShopVisit(
  client: Client,
  params: { externalId: string; name: string; lat: number; lng: number; rating: number; note?: string; visitedAt?: string }
) {
  const { data, error } = await client.rpc("log_shop_visit", {
    p_external_id: params.externalId,
    p_name: params.name,
    p_lat: params.lat,
    p_lng: params.lng,
    p_rating: params.rating,
    p_note: params.note,
    p_visited_at: params.visitedAt,
  });
  if (error) throw error;
  return data;
}

export async function getProfilesByIds(client: Client, ids: string[]) {
  if (ids.length === 0) return [];
  const { data, error } = await client
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", ids);
  if (error) throw error;
  return data;
}

export async function getCitiesByIds(client: Client, ids: string[]) {
  if (ids.length === 0) return [];
  const { data, error } = await client.from("cities").select("id, name").in("id", ids);
  if (error) throw error;
  return data;
}

export async function getLogLikes(client: Client, logIds: string[]) {
  if (logIds.length === 0) return [];
  const { data, error } = await client.from("log_likes").select("log_id, user_id").in("log_id", logIds);
  if (error) throw error;
  return data;
}

export async function setLogLike(client: Client, logId: string, userId: string, liked: boolean) {
  if (liked) {
    const { error } = await client.from("log_likes").insert({ log_id: logId, user_id: userId });
    if (error) throw error;
  } else {
    const { error } = await client.from("log_likes").delete().eq("log_id", logId).eq("user_id", userId);
    if (error) throw error;
  }
}

export async function getComments(client: Client, logId: string) {
  const { data, error } = await client
    .from("comments")
    .select("id, parent_comment_id, user_id, body, created_at")
    .eq("log_id", logId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getCommentLikes(client: Client, commentIds: string[]) {
  if (commentIds.length === 0) return [];
  const { data, error } = await client.from("comment_likes").select("comment_id, user_id").in("comment_id", commentIds);
  if (error) throw error;
  return data;
}

export async function setCommentLike(client: Client, commentId: string, userId: string, liked: boolean) {
  if (liked) {
    const { error } = await client.from("comment_likes").insert({ comment_id: commentId, user_id: userId });
    if (error) throw error;
  } else {
    const { error } = await client.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", userId);
    if (error) throw error;
  }
}

export async function postComment(
  client: Client,
  params: { logId: string; userId: string; body: string; parentCommentId?: string }
) {
  const { data, error } = await client
    .from("comments")
    .insert({ log_id: params.logId, user_id: params.userId, body: params.body, parent_comment_id: params.parentCommentId ?? null })
    .select("id, log_id, parent_comment_id, user_id, body, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function getCommentCountsByLog(client: Client, logIds: string[]) {
  if (logIds.length === 0) return [];
  const { data, error } = await client.from("comments").select("log_id").in("log_id", logIds);
  if (error) throw error;
  return data;
}
