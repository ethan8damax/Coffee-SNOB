import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

type Client = SupabaseClient<Database>;

// Add a shop (0036): anyone sends one, an admin puts it on the map or passes.

export type ShopSubmissionInput = {
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
  hours?: string | null;
  website?: string | null;
  roaster?: string | null;
  note?: string | null;
  locality?: string | null;
  region?: string | null;
  countryCode?: string | null;
};

const opt = (v: string | null | undefined) => (v && v.trim() ? v.trim() : undefined);

// shopId is set only when an admin sent it (live at once).
export async function submitShop(client: Client, input: ShopSubmissionInput): Promise<{ submissionId: string; shopId: string | null }> {
  const { data, error } = await client.rpc("submit_shop", {
    p_name: input.name.trim(),
    p_lat: input.lat,
    p_lng: input.lng,
    p_address: opt(input.address),
    p_hours: opt(input.hours),
    p_website: opt(input.website),
    p_roaster: opt(input.roaster),
    p_note: opt(input.note),
    p_locality: opt(input.locality),
    p_region: opt(input.region),
    p_country_code: opt(input.countryCode),
  });
  if (error) throw error;
  const row = data[0];
  return { submissionId: row.submission_id, shopId: row.shop_id };
}

export type ShopSubmission = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  hours: string | null;
  website: string | null;
  roaster: string | null;
  note: string | null;
  locality: string | null;
  region: string | null;
  status: "pending" | "approved" | "declined";
  declineReason: string | null;
  shopId: string | null;
  sender: string | null; // username
  createdAt: string;
  reviewedAt: string | null;
};

const SUBMISSION_COLUMNS =
  "id, name, lat, lng, address, hours, website, roaster, note, locality, region, status, decline_reason, shop_id, created_at, reviewed_at, profiles!shop_submissions_user_id_fkey(username)";

type SubmissionRow = {
  id: string; name: string; lat: number; lng: number; address: string | null; hours: string | null; website: string | null;
  roaster: string | null; note: string | null; locality: string | null; region: string | null; status: string;
  decline_reason: string | null; shop_id: string | null; created_at: string; reviewed_at: string | null;
  profiles: { username: string | null } | null;
};

const toSubmission = (r: SubmissionRow): ShopSubmission => ({
  id: r.id, name: r.name, lat: r.lat, lng: r.lng, address: r.address, hours: r.hours, website: r.website,
  roaster: r.roaster, note: r.note, locality: r.locality, region: r.region,
  status: r.status as ShopSubmission["status"], declineReason: r.decline_reason, shopId: r.shop_id,
  sender: r.profiles?.username ?? null, createdAt: r.created_at, reviewedAt: r.reviewed_at,
});

// Admin: everything waiting, oldest first (first come, first looked at).
export async function getPendingSubmissions(client: Client): Promise<ShopSubmission[]> {
  const { data, error } = await client.from("shop_submissions").select(SUBMISSION_COLUMNS).eq("status", "pending").order("created_at");
  if (error) throw error;
  return (data as unknown as SubmissionRow[]).map(toSubmission);
}

export async function getDecidedSubmissions(client: Client, limit = 20): Promise<ShopSubmission[]> {
  const { data, error } = await client
    .from("shop_submissions")
    .select(SUBMISSION_COLUMNS)
    .neq("status", "pending")
    .order("reviewed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as SubmissionRow[]).map(toSubmission);
}

export async function approveSubmission(
  client: Client,
  id: string,
  edits: { name: string; lat: number; lng: number; address?: string | null; hours?: string | null; website?: string | null },
): Promise<string> {
  const { data, error } = await client.rpc("approve_shop_submission", {
    p_id: id,
    p_name: edits.name.trim(),
    p_lat: edits.lat,
    p_lng: edits.lng,
    p_address: opt(edits.address),
    p_hours: opt(edits.hours),
    p_website: opt(edits.website),
  });
  if (error) throw error;
  return data;
}

export async function declineSubmission(client: Client, id: string, reason?: string | null): Promise<void> {
  const { error } = await client.rpc("decline_shop_submission", { p_id: id, p_reason: opt(reason) });
  if (error) throw error;
}

// Hand-added shops nobody has logged yet: the map shows them as café dots.
// (Once logged they come back through shop_ratings as rated pins.)
export type AddedShop = {
  id: string;
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  hours: string | null;
  website: string | null;
  phone: string | null;
  locality: string | null;
};

const ADDED_COLUMNS = "id, external_id, name, lat, lng, address, hours, website, phone, locality";
type AddedRow = { id: string; external_id: string | null; name: string; lat: number | null; lng: number | null; address: string | null; hours: string | null; website: string | null; phone: string | null; locality: string | null };
const toAdded = (r: AddedRow): AddedShop => ({
  id: r.id, externalId: r.external_id!, name: r.name, lat: r.lat!, lng: r.lng!,
  address: r.address, hours: r.hours, website: r.website, phone: r.phone, locality: r.locality,
});

export async function getAddedShopsInBounds(
  client: Client,
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
): Promise<AddedShop[]> {
  const { data, error } = await client
    .from("shops")
    .select(ADDED_COLUMNS)
    .like("external_id", "user/%")
    .is("closed_at", null)
    .gte("lat", bounds.minLat)
    .lte("lat", bounds.maxLat)
    .gte("lng", bounds.minLng)
    .lte("lng", bounds.maxLng);
  if (error) throw error;
  return data.map(toAdded);
}

// Same word rule as searchRatedShops: every word in the name or the city.
export async function searchAddedShops(client: Client, query: string, limit = 8): Promise<AddedShop[]> {
  const q = query.trim().replace(/[%_\\,()]/g, "");
  if (q.length < 2) return [];
  let request = client.from("shops").select(ADDED_COLUMNS).like("external_id", "user/%").is("closed_at", null);
  for (const word of q.split(/\s+/)) request = request.or(`name.ilike.%${word}%,locality.ilike.%${word}%`);
  const { data, error } = await request.limit(limit);
  if (error) throw error;
  return data.map(toAdded);
}

// Admin duplicate check: our shops within ~`meters` of a point.
export async function getShopsNear(client: Client, lat: number, lng: number, meters = 150): Promise<{ id: string; name: string; lat: number; lng: number }[]> {
  const dLat = meters / 111_320;
  const dLng = dLat / Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  const { data, error } = await client
    .from("shops")
    .select("id, name, lat, lng")
    .gte("lat", lat - dLat)
    .lte("lat", lat + dLat)
    .gte("lng", lng - dLng)
    .lte("lng", lng + dLng)
    .limit(10);
  if (error) throw error;
  return data.flatMap((r) => (r.lat != null && r.lng != null ? [{ id: r.id, name: r.name, lat: r.lat, lng: r.lng }] : []));
}

// Everything you've sent, newest first (RLS: only your own).
export async function getMySubmissions(client: Client, userId: string): Promise<ShopSubmission[]> {
  const { data, error } = await client.from("shop_submissions").select(SUBMISSION_COLUMNS).eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as SubmissionRow[]).map(toSubmission);
}
