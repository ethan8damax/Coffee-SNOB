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

export async function getCityGuide(client: Client, citySlug: string) {
  const { data: city, error: cityError } = await client
    .from("cities")
    .select("id, slug, name, country, region, status")
    .eq("slug", citySlug)
    .single();
  if (cityError) throw cityError;

  const { data: guide, error: guideError } = await client
    .from("lists")
    .select(
      "id, slug, title, description, body, cover_photo_alt, save_count, list_items(position, note, shops(id, name, neighborhood, price_tier, tag, writeup, order_note, editorial_rating))"
    )
    .eq("type", "city_guide")
    .eq("city_id", city.id)
    .single();
  if (guideError) throw guideError;

  return { city, guide };
}
