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

// Global (not bounded to the current viewport) name search over rated shops, for the
// map's search bar. `%` `_` `\` are stripped so a query can't act as a wildcard.
export async function searchRatedShops(client: Client, query: string, limit = 8) {
  const q = query.trim().replace(/[%_\\]/g, "");
  if (q.length < 2) return [];
  const { data, error } = await client
    .from("shop_ratings")
    .select("id, name, lat, lng, neighborhood, is_snob_approved, tag, price_tier, rating, log_count")
    .ilike("name", `%${q}%`)
    .not("rating", "is", null)
    .order("rating", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// Superseded by logVisit. Since 0015 the RPC returns [{ shop_id, log_id }] rather than the logs row.
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

export async function getFollowedUserIds(client: Client, userId: string) {
  const { data, error } = await client.from("follows").select("followee_id").eq("follower_id", userId);
  if (error) throw error;
  return data.map((row) => row.followee_id);
}

export async function getFollowingFeedLogs(client: Client, followeeIds: string[]) {
  if (followeeIds.length === 0) return [];
  const { data, error } = await client
    .from("logs")
    .select("id, user_id, shop_id, rating, note, visited_at, created_at, shops(name, neighborhood)")
    .in("user_id", followeeIds)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

export async function getFollowingFeedLists(client: Client, followeeIds: string[]) {
  const orFilter =
    followeeIds.length > 0 ? `curator_id.is.null,curator_id.in.(${followeeIds.join(",")})` : "curator_id.is.null";
  const { data, error } = await client
    .from("lists")
    .select("id, slug, type, title, description, curator_id, city_id, cover_photo_alt, created_at, list_items(count)")
    .or(orFilter)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data;
}

export async function getShopsInBounds(
  client: Client,
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }
) {
  const { data, error } = await client
    .from("shops")
    .select("id, name, neighborhood, lat, lng")
    .gte("lat", bounds.minLat)
    .lte("lat", bounds.maxLat)
    .gte("lng", bounds.minLng)
    .lte("lng", bounds.maxLng);
  if (error) throw error;
  return data;
}

export async function getLogsForShops(client: Client, shopIds: string[]) {
  if (shopIds.length === 0) return [];
  const { data, error } = await client
    .from("logs")
    .select("id, user_id, shop_id, rating, note, visited_at, created_at")
    .in("shop_id", shopIds)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

export async function getLiveCityGuides(client: Client) {
  const { data: liveCities, error: citiesError } = await client.from("cities").select("id, name").eq("status", "live");
  if (citiesError) throw citiesError;
  if (liveCities.length === 0) return [];

  const { data, error } = await client
    .from("lists")
    .select("id, slug, title, description, cover_photo_alt, created_at, city_id, list_items(count)")
    .eq("type", "city_guide")
    .in(
      "city_id",
      liveCities.map((c) => c.id)
    )
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;

  const cityNameById = new Map(liveCities.map((c) => [c.id, c.name]));
  return data.map((guide) => ({ ...guide, cityName: cityNameById.get(guide.city_id as string) ?? null }));
}

// ── Shop page ─────────────────────────────────────────────────────
export type ShopDetail = {
  id: string;
  name: string;
  neighborhood: string | null;
  lat: number;
  lng: number;
  address: string | null;
  website: string | null;
  phone: string | null;
  // Raw OSM `opening_hours` string (e.g. "Mo-Fr 07:30-18:00; Sa,Su 09:00-17:00"), unparsed.
  hours: string | null;
  // Mean verdict 1..5 rounded to one decimal; null when the shop has no logs.
  rating: number | null;
  logCount: number;
  // Most common verdict 1..5 (ties → higher verdict); null when no logs.
  topVerdict: number | null;
};

export type ShopReview = {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  rating: number; // 1..5
  note: string | null;
  drink: string | null;
  visitedAt: string; // YYYY-MM-DD
  createdAt: string; // ISO timestamp
};

export function summarizeVerdicts(ratings: number[]): { rating: number | null; logCount: number; topVerdict: number | null } {
  if (ratings.length === 0) return { rating: null, logCount: 0, topVerdict: null };
  const counts = new Map<number, number>();
  for (const r of ratings) counts.set(r, (counts.get(r) ?? 0) + 1);
  let topVerdict = 0;
  let topCount = 0;
  for (const [verdict, count] of counts) {
    if (count > topCount || (count === topCount && verdict > topVerdict)) {
      topVerdict = verdict;
      topCount = count;
    }
  }
  const mean = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  return { rating: Math.round(mean * 10) / 10, logCount: ratings.length, topVerdict };
}

export async function getShopDetail(client: Client, shopId: string): Promise<ShopDetail | null> {
  const { data: shop, error: shopError } = await client
    .from("shops")
    .select("id, name, neighborhood, lat, lng, address, website, phone, hours")
    .eq("id", shopId)
    .maybeSingle();
  if (shopError) throw shopError;
  if (!shop) return null;

  // ponytail: pulls every rating for the shop and aggregates in JS (fine to ~thousands of logs per shop);
  // move to a per-shop aggregate view/RPC when a single shop's log count gets large.
  const { data: logs, error: logsError } = await client.from("logs").select("rating").eq("shop_id", shopId);
  if (logsError) throw logsError;

  return {
    id: shop.id,
    name: shop.name,
    neighborhood: shop.neighborhood,
    lat: shop.lat as number, // nullable in the schema, but every shop has coordinates today
    lng: shop.lng as number,
    address: shop.address,
    website: shop.website,
    phone: shop.phone,
    hours: shop.hours,
    ...summarizeVerdicts(logs.map((l) => l.rating)),
  };
}

// Newest first (by created_at).
export async function getShopReviews(client: Client, shopId: string, opts?: { limit?: number }): Promise<ShopReview[]> {
  const { data: logs, error } = await client
    .from("logs")
    .select("id, user_id, rating, note, drink, visited_at, created_at")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (error) throw error;
  if (logs.length === 0) return [];

  // logs.user_id references auth.users, not profiles, so PostgREST can't embed the author — fetch separately.
  const profiles = await getProfilesByIds(client, [...new Set(logs.map((l) => l.user_id))]);
  const byId = new Map(profiles.map((p) => [p.id, p]));

  return logs.map((l) => ({
    id: l.id,
    userId: l.user_id,
    username: byId.get(l.user_id)?.username ?? "unknown",
    displayName: byId.get(l.user_id)?.display_name ?? null,
    rating: l.rating,
    note: l.note,
    drink: l.drink,
    visitedAt: l.visited_at,
    createdAt: l.created_at,
  }));
}

// ── Logging a visit ───────────────────────────────────────────────
type LogVisitCommon = {
  rating: number; // 1..5
  note?: string | null;
  drink?: string | null;
  visitedAt?: string; // YYYY-MM-DD, defaults to today
};

export type LogVisitInput =
  | ({ kind: "existing"; shopId: string } & LogVisitCommon)
  | ({
      kind: "osm";
      externalId: string; // e.g. "node/123456"
      name: string;
      lat: number;
      lng: number;
      address?: string | null;
      website?: string | null;
      phone?: string | null;
      hours?: string | null;
    } & LogVisitCommon);

const blankToNull = (s: string | null | undefined) => s?.trim() || null;

// `userId` must be the signed-in user (RLS enforces logs.user_id = auth.uid()).
export async function logVisit(client: Client, userId: string, input: LogVisitInput): Promise<{ shopId: string; logId: string }> {
  if (input.kind === "existing") {
    const { data, error } = await client
      .from("logs")
      .insert({
        user_id: userId,
        shop_id: input.shopId,
        rating: input.rating,
        note: blankToNull(input.note),
        drink: blankToNull(input.drink),
        visited_at: input.visitedAt,
      })
      .select("id, shop_id")
      .single();
    if (error) throw error;
    return { shopId: data.shop_id, logId: data.id };
  }

  // The RPC reads the user from auth.uid() itself (and trims/caps the text fields), so userId isn't sent.
  const { data, error } = await client.rpc("log_shop_visit", {
    p_external_id: input.externalId,
    p_name: input.name,
    p_lat: input.lat,
    p_lng: input.lng,
    p_rating: input.rating,
    p_note: blankToNull(input.note) ?? undefined,
    p_visited_at: input.visitedAt,
    p_drink: blankToNull(input.drink) ?? undefined,
    p_address: input.address ?? undefined,
    p_website: input.website ?? undefined,
    p_phone: input.phone ?? undefined,
    p_hours: input.hours ?? undefined,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error("log_shop_visit returned no row");
  return { shopId: row.shop_id, logId: row.log_id };
}

// ── Profiles ──────────────────────────────────────────────────────
export type PublicProfile = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

export type ProfileStats = { entries: number; followers: number; following: number };

export type ProfileEntry = {
  id: string;
  shopId: string;
  shopName: string;
  shopNeighborhood: string | null;
  rating: number; // 1..5
  note: string | null;
  drink: string | null;
  visitedAt: string;
  createdAt: string;
};

export async function getPublicProfileByUsername(client: Client, username: string): Promise<PublicProfile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, created_at")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    bio: data.bio,
    avatarUrl: data.avatar_url,
    createdAt: data.created_at,
  };
}

export async function getProfileStats(client: Client, userId: string): Promise<ProfileStats> {
  const [entries, followers, following] = await Promise.all([
    client.from("logs").select("*", { count: "exact", head: true }).eq("user_id", userId),
    client.from("follows").select("*", { count: "exact", head: true }).eq("followee_id", userId),
    client.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
  ]);
  for (const r of [entries, followers, following]) if (r.error) throw r.error;
  return { entries: entries.count ?? 0, followers: followers.count ?? 0, following: following.count ?? 0 };
}

// Newest first (by visited_at, then created_at).
export async function getProfileEntries(
  client: Client,
  userId: string,
  opts?: { limit?: number; offset?: number }
): Promise<ProfileEntry[]> {
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;
  const { data, error } = await client
    .from("logs")
    .select("id, shop_id, rating, note, drink, visited_at, created_at, shops(name, neighborhood)")
    .eq("user_id", userId)
    .order("visited_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data.map((l) => ({
    id: l.id,
    shopId: l.shop_id,
    shopName: l.shops?.name ?? "",
    shopNeighborhood: l.shops?.neighborhood ?? null,
    rating: l.rating,
    note: l.note,
    drink: l.drink,
    visitedAt: l.visited_at,
    createdAt: l.created_at,
  }));
}

export async function isFollowing(client: Client, followerId: string, followeeId: string): Promise<boolean> {
  const { data, error } = await client
    .from("follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("followee_id", followeeId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function setFollow(client: Client, followerId: string, followeeId: string, following: boolean): Promise<void> {
  if (following) {
    // upsert-ignore so a double tap doesn't surface a duplicate-key error
    const { error } = await client
      .from("follows")
      .upsert({ follower_id: followerId, followee_id: followeeId }, { onConflict: "follower_id,followee_id", ignoreDuplicates: true });
    if (error) throw error;
  } else {
    const { error } = await client.from("follows").delete().eq("follower_id", followerId).eq("followee_id", followeeId);
    if (error) throw error;
  }
}

export async function updateProfile(
  client: Client,
  userId: string,
  fields: { displayName?: string | null; bio?: string | null }
): Promise<void> {
  const update: { display_name?: string | null; bio?: string | null } = {};
  if (fields.displayName !== undefined) update.display_name = blankToNull(fields.displayName);
  if (fields.bio !== undefined) update.bio = blankToNull(fields.bio);
  if (Object.keys(update).length === 0) return;
  const { error } = await client.from("profiles").update(update).eq("id", userId);
  if (error) throw error;
}

// ── U2: history, faves, saves, people ─────────────────────────────
// Just the visit dates (for the heatmap), newest first; 1000 rows is far past what the grid shows.
export async function getProfileVisitDates(client: Client, userId: string, since: string): Promise<string[]> {
  const { data, error } = await client
    .from("logs")
    .select("visited_at")
    .eq("user_id", userId)
    .gte("visited_at", since)
    .order("visited_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data.map((l) => l.visited_at);
}

// Their 4–5 verdicts, best and newest first.
export async function getProfileFaves(client: Client, userId: string, limit = 30): Promise<ProfileEntry[]> {
  const { data, error } = await client
    .from("logs")
    .select("id, shop_id, rating, note, drink, visited_at, created_at, shops(name, neighborhood)")
    .eq("user_id", userId)
    .gte("rating", 4)
    .order("rating", { ascending: false })
    .order("visited_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((l) => ({
    id: l.id,
    shopId: l.shop_id,
    shopName: l.shops?.name ?? "",
    shopNeighborhood: l.shops?.neighborhood ?? null,
    rating: l.rating,
    note: l.note,
    drink: l.drink,
    visitedAt: l.visited_at,
    createdAt: l.created_at,
  }));
}

export type SavedShop = { shopId: string; name: string; neighborhood: string | null; savedAt: string };

// Private: RLS only ever returns the signed-in user's own saves.
export async function getSavedShops(client: Client, userId: string): Promise<SavedShop[]> {
  const { data, error } = await client
    .from("shop_saves")
    .select("shop_id, created_at, shops(name, neighborhood)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((s) => ({ shopId: s.shop_id, name: s.shops?.name ?? "", neighborhood: s.shops?.neighborhood ?? null, savedAt: s.created_at }));
}

export async function isShopSaved(client: Client, userId: string, shopId: string): Promise<boolean> {
  const { data, error } = await client.from("shop_saves").select("shop_id").eq("user_id", userId).eq("shop_id", shopId).maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function setShopSaved(client: Client, userId: string, shopId: string, saved: boolean): Promise<void> {
  if (saved) {
    const { error } = await client
      .from("shop_saves")
      .upsert({ user_id: userId, shop_id: shopId }, { onConflict: "user_id,shop_id", ignoreDuplicates: true });
    if (error) throw error;
  } else {
    const { error } = await client.from("shop_saves").delete().eq("user_id", userId).eq("shop_id", shopId);
    if (error) throw error;
  }
}

export type PersonRow = { id: string; username: string; displayName: string | null };

// Who follows `userId` ("followers") or who they follow ("following").
export async function getFollowList(client: Client, userId: string, kind: "followers" | "following"): Promise<PersonRow[]> {
  const [mine, theirs] = kind === "followers" ? (["followee_id", "follower_id"] as const) : (["follower_id", "followee_id"] as const);
  const { data, error } = await client.from("follows").select(theirs).eq(mine, userId).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  const ids = data.map((r) => (r as Record<string, string>)[theirs]);
  if (ids.length === 0) return [];
  const { data: profiles, error: pErr } = await client.from("profiles").select("id, username, display_name").in("id", ids);
  if (pErr) throw pErr;
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return ids.flatMap((id) => {
    const p = byId.get(id);
    return p ? [{ id: p.id, username: p.username, displayName: p.display_name }] : [];
  });
}

// Prefix match on username. `%` `_` `\` are stripped so a query can't act as a wildcard.
export async function searchProfiles(client: Client, query: string): Promise<PersonRow[]> {
  const q = query.trim().toLowerCase().replace(/[%_\\]/g, "");
  if (q.length < 2) return [];
  const { data, error } = await client.from("profiles").select("id, username, display_name").ilike("username", `${q}%`).order("username").limit(20);
  if (error) throw error;
  return data.map((p) => ({ id: p.id, username: p.username, displayName: p.display_name }));
}
