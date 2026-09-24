import { describe, it, expect, vi, afterEach } from "vitest";
import { readLastLocation, saveLastLocation } from "./fallback";

afterEach(() => vi.unstubAllGlobals());

describe("last known location", () => {
  it("round-trips through localStorage", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    saveLastLocation({ lat: 33.75, lng: -84.36 });
    expect(readLastLocation()).toEqual({ lat: 33.75, lng: -84.36 });
  });

  it("returns null when storage is missing, throws, or holds junk", () => {
    expect(readLastLocation()).toBeNull();
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    expect(readLastLocation()).toBeNull();
    expect(() => saveLastLocation({ lat: 1, lng: 2 })).not.toThrow();
    vi.stubGlobal("localStorage", { getItem: () => "{nope", setItem: () => {} });
    expect(readLastLocation()).toBeNull();
  });
});
