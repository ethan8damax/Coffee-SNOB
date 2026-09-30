import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlaceFlagKind } from "./queries";
import type { Database, Json } from "./types";

type Client = SupabaseClient<Database>;

// Tell us (0037): bugs, ideas, and messages, plus the reports a person sent.

export type MessageKind = "bug" | "idea" | "contact";
export type MessageStatus = "sent" | "seen" | "done" | "passed";
// What the app attaches: never typed by the sender.
export type MessageContext = { platform?: string; version?: string; screen?: string; viewport?: string; agent?: string };

export type Message = {
  id: string;
  kind: MessageKind;
  body: string;
  context: MessageContext;
  status: MessageStatus;
  reason: string | null;
  sender: string | null; // username
  createdAt: string;
  decidedAt: string | null;
};

export async function sendMessage(client: Client, kind: MessageKind, body: string, context: MessageContext = {}): Promise<string> {
  const { data, error } = await client.rpc("send_message", { p_kind: kind, p_body: body.trim(), p_context: context as Json });
  if (error) throw error;
  return data;
}

const MESSAGE_COLUMNS = "id, kind, body, context, status, reason, created_at, decided_at, profiles!messages_user_id_fkey(username)";
type MessageRow = {
  id: string; kind: string; body: string; context: Json; status: string; reason: string | null;
  created_at: string; decided_at: string | null; profiles: { username: string | null } | null;
};
const toMessage = (r: MessageRow): Message => ({
  id: r.id, kind: r.kind as MessageKind, body: r.body, context: (r.context ?? {}) as MessageContext,
  status: r.status as MessageStatus, reason: r.reason, sender: r.profiles?.username ?? null,
  createdAt: r.created_at, decidedAt: r.decided_at,
});

// Admin: sent and seen, oldest first. Decided: newest decisions first.
export async function getOpenMessages(client: Client): Promise<Message[]> {
  const { data, error } = await client.from("messages").select(MESSAGE_COLUMNS).in("status", ["sent", "seen"]).order("created_at");
  if (error) throw error;
  return (data as unknown as MessageRow[]).map(toMessage);
}

export async function getDecidedMessages(client: Client, limit = 20): Promise<Message[]> {
  const { data, error } = await client
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .in("status", ["done", "passed"])
    .order("decided_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as MessageRow[]).map(toMessage);
}

export async function markMessageSeen(client: Client, id: string): Promise<void> {
  const { error } = await client.rpc("mark_message_seen", { p_id: id });
  if (error) throw error;
}

export async function decideMessage(client: Client, id: string, outcome: "done" | "passed", reason?: string | null): Promise<void> {
  const { error } = await client.rpc("decide_message", { p_id: id, p_outcome: outcome, p_reason: reason?.trim() || undefined });
  if (error) throw error;
}

export async function getMessageSenderEmail(client: Client, id: string): Promise<string | null> {
  const { data, error } = await client.rpc("message_sender_email", { p_id: id });
  if (error) throw error;
  return data ?? null;
}

// ── What you've sent ─────────────────────────────────────────────────
export type MyReport = {
  id: string;
  kind: PlaceFlagKind;
  placeName: string;
  shopId: string | null;
  note: string | null;
  outcome: "done" | "passed" | null;
  resolved: boolean;
  reason: string | null;
  createdAt: string;
};

export async function getMyReports(client: Client, userId: string): Promise<MyReport[]> {
  const { data, error } = await client
    .from("place_flags")
    .select("id, kind, place_name, shop_id, note, outcome, resolved_at, reason, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data.map((r) => ({
    id: r.id, kind: r.kind as PlaceFlagKind, placeName: r.place_name, shopId: r.shop_id, note: r.note,
    outcome: r.outcome as MyReport["outcome"], resolved: r.resolved_at !== null, reason: r.reason, createdAt: r.created_at,
  }));
}

export async function getMyMessages(client: Client, userId: string): Promise<Message[]> {
  const { data, error } = await client
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data as unknown as MessageRow[]).map(toMessage);
}
