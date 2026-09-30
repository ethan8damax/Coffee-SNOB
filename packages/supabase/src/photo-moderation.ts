import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShopPhoto } from "./queries";
import type { Database } from "./types";

type Client = SupabaseClient<Database>;

// Photo reports and the admin's calls (photos Phase 3, 0040).

export type PhotoReportReason = "wrong_shop" | "inappropriate" | "not_theirs" | "other";

// "already": this person reported this photo before (one report each).
export async function reportPhoto(client: Client, photoId: string, reason: PhotoReportReason): Promise<"sent" | "already"> {
  const { error } = await client.from("photo_flags").insert({ photo_id: photoId, reason });
  if (!error) return "sent";
  if (error.code === "23505") return "already";
  throw new Error(error.message);
}

// Keeps (back to live) or removes a photo, resolves its reports, tells the reporters.
export async function decidePhoto(client: Client, photoId: string, outcome: "kept" | "removed"): Promise<number> {
  const { data, error } = await client.rpc("decide_photo", { p_photo_id: photoId, p_outcome: outcome });
  if (error) throw error;
  return data;
}

// Pins a live photo of the shop as its header, or unpins (null). The 0038
// trigger refuses anything else.
export async function setShopHeader(client: Client, shopId: string, photoId: string | null): Promise<void> {
  const { error } = await client.from("shops").update({ header_photo_id: photoId }).eq("id", shopId);
  if (error) throw error;
}

export type ModerationPhoto = {
  id: string;
  thumbPath: string;
  status: "live" | "hidden" | "removed";
  shopId: string;
  shopName: string;
  username: string | null;
  reasons: Partial<Record<PhotoReportReason, number>>;
  createdAt: string;
};

// The Inbox's Photos box: every hidden photo and every photo with open
// reports. Hidden first, then newest.
export async function getModerationPhotos(client: Client): Promise<ModerationPhoto[]> {
  const [flags, hidden] = await Promise.all([
    client.from("photo_flags").select("photo_id, reason").is("resolved_at", null),
    client.from("log_photos").select("id").eq("status", "hidden"),
  ]);
  if (flags.error) throw flags.error;
  if (hidden.error) throw hidden.error;
  const ids = [...new Set([...flags.data.map((f) => f.photo_id), ...hidden.data.map((h) => h.id)])];
  if (ids.length === 0) return [];
  // Two links join photos and shops (its shop; a shop's pin), so name the one we mean.
  const { data, error } = await client
    .from("log_photos")
    .select("id, thumb_path, status, created_at, shop_id, shops!log_photos_shop_id_fkey(name), profiles(username)")
    .in("id", ids);
  if (error) throw error;
  return data
    .map((p) => {
      const reasons: ModerationPhoto["reasons"] = {};
      for (const f of flags.data) if (f.photo_id === p.id) reasons[f.reason as PhotoReportReason] = (reasons[f.reason as PhotoReportReason] ?? 0) + 1;
      return {
        id: p.id,
        thumbPath: p.thumb_path,
        status: p.status as ModerationPhoto["status"],
        shopId: p.shop_id,
        shopName: (p.shops as { name: string } | null)?.name ?? "",
        username: (p.profiles as { username: string | null } | null)?.username ?? null,
        reasons,
        createdAt: p.created_at,
      };
    })
    .sort((a, b) => Number(b.status === "hidden") - Number(a.status === "hidden") || b.createdAt.localeCompare(a.createdAt));
}

// The shop editor's Photos panel: the current pin and the shop's live photos.
export async function getShopPhotoAdmin(client: Client, shopId: string): Promise<{ pinnedId: string | null; photos: ShopPhoto[] }> {
  const [shop, photos] = await Promise.all([
    client.from("shops").select("header_photo_id").eq("id", shopId).maybeSingle(),
    client
      .from("log_photos")
      .select("id, path, thumb_path, width, height, profiles(username)")
      .eq("shop_id", shopId)
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);
  if (shop.error) throw shop.error;
  if (photos.error) throw photos.error;
  return {
    pinnedId: shop.data?.header_photo_id ?? null,
    photos: photos.data.map((p) => ({ id: p.id, path: p.path, thumbPath: p.thumb_path, width: p.width, height: p.height, username: p.profiles?.username ?? null })),
  };
}
