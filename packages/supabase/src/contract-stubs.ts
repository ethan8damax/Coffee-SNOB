// CONTRACT STUBS — written so the app UI can be built in parallel with the
// real data layer. Agent A (data layer) replaces every function body here with
// a real implementation in queries.ts and DELETES this file, keeping the
// exported names and the shapes below exactly as-is. UI code must import only
// from "@coffeesnob/supabase" and depend only on these shapes.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

type Client = SupabaseClient<Database>;

// ── Shop page (M3) ────────────────────────────────────────────────
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

export async function getShopDetail(_client: Client, _shopId: string): Promise<ShopDetail | null> {
  throw new Error("not implemented: getShopDetail");
}

// Newest first (by created_at).
export async function getShopReviews(_client: Client, _shopId: string, _opts?: { limit?: number }): Promise<ShopReview[]> {
  throw new Error("not implemented: getShopReviews");
}

// ── Logging a visit (M4) ──────────────────────────────────────────
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

// `userId` must be the signed-in user (RLS enforces logs.user_id = auth.uid()).
export async function logVisit(_client: Client, _userId: string, _input: LogVisitInput): Promise<{ shopId: string; logId: string }> {
  throw new Error("not implemented: logVisit");
}

// ── Profiles (U1) ─────────────────────────────────────────────────
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

export async function getPublicProfileByUsername(_client: Client, _username: string): Promise<PublicProfile | null> {
  throw new Error("not implemented: getPublicProfileByUsername");
}

export async function getProfileStats(_client: Client, _userId: string): Promise<ProfileStats> {
  throw new Error("not implemented: getProfileStats");
}

// Newest first (by visited_at, then created_at).
export async function getProfileEntries(
  _client: Client,
  _userId: string,
  _opts?: { limit?: number; offset?: number }
): Promise<ProfileEntry[]> {
  throw new Error("not implemented: getProfileEntries");
}

export async function isFollowing(_client: Client, _followerId: string, _followeeId: string): Promise<boolean> {
  throw new Error("not implemented: isFollowing");
}

export async function setFollow(_client: Client, _followerId: string, _followeeId: string, _following: boolean): Promise<void> {
  throw new Error("not implemented: setFollow");
}

export async function updateProfile(
  _client: Client,
  _userId: string,
  _fields: { displayName?: string | null; bio?: string | null }
): Promise<void> {
  throw new Error("not implemented: updateProfile");
}
