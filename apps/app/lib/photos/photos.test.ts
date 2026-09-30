import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fitLongEdge } from "./sizes";
import { uploadLogPhoto, type CompressedPhoto } from "./upload";
import { _resetPending, enqueuePhoto, isPending, previewFor, subscribe } from "./pending";

describe("fitLongEdge", () => {
  it("scales the long edge down to the limit, keeping the shape", () => {
    expect(fitLongEdge(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitLongEdge(3024, 4032, 640)).toEqual({ width: 480, height: 640 });
  });

  it("never upscales", () => {
    expect(fitLongEdge(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

describe("uploadLogPhoto", () => {
  const photo: CompressedPhoto = { ext: "webp", full: { uri: "file:///full.webp", width: 1600, height: 1200 }, thumb: { uri: "file:///thumb.webp" } };

  function fakeFetch(fail?: string) {
    const calls: { url: string; method: string; headers: Record<string, string>; body: unknown }[] = [];
    const impl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET", headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body });
      if (url.startsWith("file://")) return new Response(`bytes of ${url}`);
      if (fail && url.includes(fail)) return new Response(JSON.stringify({ error: "nope" }), { status: 409 });
      if (url.endsWith("/api/photos/sign")) return Response.json({ photoId: "p1", fullUrl: "https://r2/full?sig", thumbUrl: "https://r2/thumb?sig" });
      if (url.endsWith("/api/photos/confirm")) return Response.json({ photo: { id: "p1" } });
      return new Response(null, { status: 200 });
    });
    return { impl, calls };
  }

  it("signs, uploads both sizes with the right type, then confirms", async () => {
    const { impl, calls } = fakeFetch();
    await uploadLogPhoto({ apiBase: "https://web.test", token: "tok", logId: "l1", photo, fetchImpl: impl as typeof fetch });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST https://web.test/api/photos/sign",
      "GET file:///full.webp",
      "GET file:///thumb.webp",
      "PUT https://r2/full?sig",
      "PUT https://r2/thumb?sig",
      "POST https://web.test/api/photos/confirm",
    ]);
    expect(calls[0].headers).toMatchObject({ authorization: "Bearer tok" });
    expect(calls[3].headers).toEqual({ "content-type": "image/webp" });
    expect(JSON.parse(calls[5].body as string)).toEqual({ logId: "l1", photoId: "p1", ext: "webp", width: 1600, height: 1200 });
  });

  it("throws when any step is refused", async () => {
    await expect(uploadLogPhoto({ apiBase: "https://web.test", token: "t", logId: "l1", photo, fetchImpl: fakeFetch("sign").impl as typeof fetch })).rejects.toThrow();
    await expect(uploadLogPhoto({ apiBase: "https://web.test", token: "t", logId: "l1", photo, fetchImpl: fakeFetch("r2/thumb").impl as typeof fetch })).rejects.toThrow();
  });
});

describe("pending photo queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetPending();
  });
  afterEach(() => vi.useRealTimers());

  it("runs at once and clears on success", async () => {
    const run = vi.fn(async () => {});
    const seen: boolean[] = [];
    subscribe(() => seen.push(isPending("l1")));
    enqueuePhoto("l1", run, "file:///picked.jpg");
    expect(isPending("l1")).toBe(true);
    await vi.runOnlyPendingTimersAsync();
    expect(run).toHaveBeenCalledTimes(1);
    expect(isPending("l1")).toBe(false);
    expect(previewFor("l1")).toBe("file:///picked.jpg");
    expect(seen.at(-1)).toBe(false);
  });

  it("retries on the backoff schedule, then succeeds", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    enqueuePhoto("l1", run);
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(run).toHaveBeenCalledTimes(3);
    expect(isPending("l1")).toBe(false);
  });

  it("gives up after 24 hours", async () => {
    const run = vi.fn().mockRejectedValue(new Error("offline"));
    enqueuePhoto("l1", run, "file:///picked.jpg");
    await vi.advanceTimersByTimeAsync(25 * 3600_000);
    expect(isPending("l1")).toBe(false);
    expect(previewFor("l1")).toBeNull();
    const calls = run.mock.calls.length;
    await vi.advanceTimersByTimeAsync(3600_000);
    expect(run.mock.calls.length).toBe(calls);
  });
});
