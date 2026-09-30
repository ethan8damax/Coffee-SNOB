import { describe, expect, it } from "vitest";
import type { Message, MyReport, ShopSubmission } from "@coffeesnob/supabase";
import { sentCounts, sentLine, sentRows } from "./sent";

const shop = (id: string, status: ShopSubmission["status"], createdAt: string, extra: Partial<ShopSubmission> = {}) =>
  ({ id, name: `Shop ${id}`, status, createdAt, shopId: status === "approved" ? `s-${id}` : null, declineReason: null, ...extra }) as ShopSubmission;
const report = (id: string, createdAt: string, extra: Partial<MyReport> = {}): MyReport =>
  ({ id, kind: "closed", placeName: "Perc", shopId: null, note: null, outcome: null, resolved: false, reason: null, createdAt, ...extra });
const message = (id: string, status: Message["status"], createdAt: string, body = "The map froze"): Message =>
  ({ id, kind: "bug", body, context: {}, status, reason: null, sender: null, createdAt, decidedAt: null });

describe("sentRows", () => {
  it("merges all three, newest first, with a status each", () => {
    const rows = sentRows(
      [shop("a", "approved", "2026-09-01"), shop("b", "declined", "2026-09-03", { declineReason: "Tea only" })],
      [report("r", "2026-09-02"), report("q", "2026-09-05", { resolved: true, outcome: "passed", reason: "Still open" })],
      [message("m", "seen", "2026-09-04", "  Pins vanish on zoom\nsteps: …")],
    );
    expect(rows.map((r) => [r.type, r.title, r.status])).toEqual([
      ["Closed for good", "Perc", "Passed"],
      ["Bug", "Pins vanish on zoom", "Seen"],
      ["Shop", "Shop b", "Passed"],
      ["Closed for good", "Perc", "Sent"],
      ["Shop", "Shop a", "On the map"],
    ]);
    expect(rows[2].reason).toBe("Tea only");
    expect(rows[4]).toMatchObject({ good: true, shopId: "s-a" });
  });

  it("an old resolve without an outcome reads as done", () => {
    expect(sentRows([], [report("r", "2026-09-02", { resolved: true })], [])[0]).toMatchObject({ status: "Done", good: true, open: false });
  });

  it("cuts a long first line", () => {
    expect(sentRows([], [], [message("m", "sent", "2026-09-01", "x".repeat(90))])[0].title).toHaveLength(70);
  });
});

describe("sentCounts / sentLine", () => {
  it("nothing sent invites a shop", () => expect(sentLine(sentCounts([], []), 0)).toBe("Know a shop the map's missing? Add it."));
  it("shops live, reports fixed, then waiting", () => {
    const shops = [shop("a", "approved", "1"), shop("b", "pending", "2")];
    const rows = sentRows(shops, [report("r", "3", { resolved: true, outcome: "done" })], [message("m", "sent", "4")]);
    const c = sentCounts(shops, rows);
    expect(c).toEqual({ onMap: 1, fixed: 1, waiting: 2 });
    expect(sentLine(c, rows.length)).toBe("1 on the map because of you · 1 fixed · 2 waiting");
  });
  it("everything decided, nothing good", () => {
    const shops = [shop("b", "declined", "2")];
    expect(sentLine(sentCounts(shops, sentRows(shops, [], [])), 1)).toBe("All heard back.");
  });
});
