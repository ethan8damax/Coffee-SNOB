import { describe, expect, it, vi } from "vitest";
import { PHOTO_LIMITS } from "@coffeesnob/supabase";
import { planCleanup, runCleanup, type BucketObject, type PhotoRowRef } from "./cleanup";

const NOW = new Date("2026-10-01T08:00:00Z");
const old = "2026-09-29T08:00:00Z";
const fresh = "2026-10-01T07:00:00Z";
const obj = (key: string, lastModified = old, size = 100_000): BucketObject => ({ key, size, lastModified });
const row = (id: string, status: string): PhotoRowRef => ({ path: `logs/l/${id}.jpg`, thumb_path: `logs/l/${id}_t.jpg`, status });

describe("planCleanup", () => {
  it("keeps files of live and hidden photos, deletes removed ones and orphans older than a day", () => {
    const objects = [
      obj("logs/l/a.jpg"), obj("logs/l/a_t.jpg"), // live
      obj("logs/l/b.jpg"), obj("logs/l/b_t.jpg"), // hidden
      obj("logs/l/c.jpg"), obj("logs/l/c_t.jpg"), // removed
      obj("logs/gone/d.jpg"), // its row went with the entry
      obj("logs/new/e.jpg", fresh), // maybe still uploading
    ];
    const plan = planCleanup(objects, [row("a", "live"), row("b", "hidden"), row("c", "removed")], NOW);
    expect(plan.delete.sort()).toEqual(["logs/gone/d.jpg", "logs/l/c.jpg", "logs/l/c_t.jpg"]);
    expect(plan.blocked).toBeNull();
  });

  it("refuses to delete more than half of a bucket with 20 or more objects", () => {
    const objects = Array.from({ length: 20 }, (_, i) => obj(`logs/x/${i}.jpg`));
    const plan = planCleanup(objects, [], NOW);
    expect(plan.delete).toEqual([]);
    expect(plan.blocked).toMatch(/20 of 20/);
  });

  it("allows a small bucket to be cleared", () => {
    expect(planCleanup([obj("logs/x/1.jpg")], [], NOW).delete).toEqual(["logs/x/1.jpg"]);
  });
});

describe("runCleanup", () => {
  function deps(over: Partial<Parameters<typeof runCleanup>[0]> = {}) {
    return {
      list: vi.fn(async () => [obj("logs/l/a.jpg", old, 400_000), obj("logs/gone/d.jpg")]),
      rows: vi.fn(async () => [row("a", "live")]),
      uploadsThisMonth: vi.fn(async () => 10),
      remove: vi.fn(async () => {}),
      warn: vi.fn(),
      now: () => NOW,
      ...over,
    };
  }

  it("deletes the planned files and reports what's left", async () => {
    const d = deps();
    const summary = await runCleanup(d);
    expect(d.remove).toHaveBeenCalledWith("logs/gone/d.jpg");
    expect(d.remove).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ deleted: 1, objects: 1, bytes: 400_000, writesThisMonth: 20, warnings: [] });
  });

  it("warns at 70% of the free tier", async () => {
    const big = PHOTO_LIMITS.freeTier.bytes * 0.75;
    const d = deps({
      list: vi.fn(async () => [obj("logs/l/a.jpg", old, big)]),
      uploadsThisMonth: vi.fn(async () => PHOTO_LIMITS.freeTier.writesPerMonth * 0.4),
    });
    const summary = await runCleanup(d);
    expect(summary.warnings).toEqual([expect.stringMatching(/storage at 75%/), expect.stringMatching(/uploads at 80%/)]);
    expect(d.warn).toHaveBeenCalledTimes(2);
  });

  it("deletes nothing when the plan is blocked", async () => {
    const many = Array.from({ length: 30 }, (_, i) => obj(`logs/x/${i}.jpg`));
    const d = deps({ list: vi.fn(async () => many), rows: vi.fn(async () => []) });
    const summary = await runCleanup(d);
    expect(d.remove).not.toHaveBeenCalled();
    expect(summary.blocked).toMatch(/30 of 30/);
  });
});
