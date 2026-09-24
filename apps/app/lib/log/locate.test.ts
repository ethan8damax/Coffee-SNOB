import { describe, it, expect, vi, afterEach } from "vitest";
import { locateShop } from "./locate";

afterEach(() => vi.unstubAllGlobals());

describe("locateShop", () => {
  it("asks /api/locate with coordinates rounded to ~100 m", async () => {
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ locality: "Atlanta", region: "Georgia", countryCode: "US" }) }));
    vi.stubGlobal("fetch", fetchSpy);
    expect(await locateShop(33.74712, -84.35801, "https://example.com")).toEqual({ locality: "Atlanta", region: "Georgia", countryCode: "US" });
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/api/locate?lat=33.747&lng=-84.358");
  });

  it("never blocks logging: failures and timeouts give an empty location", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 502 })));
    expect(await locateShop(1, 2, "https://example.com")).toEqual({});
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    expect(await locateShop(1, 2, "https://example.com")).toEqual({});
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const pending = locateShop(1, 2, "https://example.com");
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toEqual({});
    vi.useRealTimers();
  });
});
