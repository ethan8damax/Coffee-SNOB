import type { Message, MessageKind, MyReport, PlaceFlagKind, ShopSubmission } from "@coffeesnob/supabase";

// Tell us: everything a person sent (shops, shop reports, messages) as one
// list, newest first, each with where it stands.

export const REPORT_LABEL: Record<PlaceFlagKind, string> = {
  closed: "Closed for good",
  wrong_location: "Moved",
  not_specialty: "Not specialty",
  wrong_info: "Wrong hours or info",
  duplicate: "Duplicate",
  other: "Something else",
};

export const MESSAGE_LABEL: Record<MessageKind, string> = { bug: "Bug", idea: "Idea", contact: "Message" };

export type SentRow = {
  key: string;
  type: string; // "Shop", "Closed for good", "Bug"…
  title: string;
  createdAt: string;
  status: string; // Waiting / On the map / Sent / Seen / Done / Passed
  good: boolean; // on the map or done: the chip goes solid
  open: boolean; // still waiting on us
  reason: string | null;
  shopId: string | null; // tap through to the shop when it's live
};

const firstLine = (s: string) => {
  const line = s.trim().split("\n")[0];
  return line.length > 70 ? `${line.slice(0, 69).trimEnd()}…` : line;
};

export function sentRows(shops: ShopSubmission[], reports: MyReport[], messages: Message[]): SentRow[] {
  const rows: SentRow[] = [
    ...shops.map((s) => ({
      key: `shop:${s.id}`,
      type: "Shop",
      title: s.name,
      createdAt: s.createdAt,
      status: s.status === "approved" ? "On the map" : s.status === "declined" ? "Passed" : "Waiting",
      good: s.status === "approved",
      open: s.status === "pending",
      reason: s.status === "declined" ? s.declineReason : null,
      shopId: s.status === "approved" ? s.shopId : null,
    })),
    ...reports.map((r) => ({
      key: `report:${r.id}`,
      type: REPORT_LABEL[r.kind],
      title: r.placeName,
      createdAt: r.createdAt,
      status: !r.resolved ? "Sent" : r.outcome === "passed" ? "Passed" : "Done",
      good: r.resolved && r.outcome !== "passed",
      open: !r.resolved,
      reason: r.reason,
      shopId: r.shopId,
    })),
    ...messages.map((m) => ({
      key: `message:${m.id}`,
      type: MESSAGE_LABEL[m.kind],
      title: firstLine(m.body),
      createdAt: m.createdAt,
      status: m.status === "sent" ? "Sent" : m.status === "seen" ? "Seen" : m.status === "done" ? "Done" : "Passed",
      good: m.status === "done",
      open: m.status === "sent" || m.status === "seen",
      reason: m.reason,
      shopId: null,
    })),
  ];
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function sentCounts(shops: ShopSubmission[], rows: SentRow[]) {
  return {
    onMap: shops.filter((s) => s.status === "approved").length,
    fixed: rows.filter((r) => r.good && !r.key.startsWith("shop:")).length,
    waiting: rows.filter((r) => r.open).length,
  };
}

// The profile link's line: what you changed first, then what's waiting.
export function sentLine(c: ReturnType<typeof sentCounts>, total: number): string {
  if (total === 0) return "Know a shop the map's missing? Add it.";
  const parts = [
    c.onMap ? `${c.onMap} on the map because of you` : null,
    c.fixed ? `${c.fixed} fixed` : null,
    c.waiting ? `${c.waiting} waiting` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "All heard back.";
}
