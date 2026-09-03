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
