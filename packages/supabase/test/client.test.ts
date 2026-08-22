import { describe, it, expect, vi } from "vitest";

const createClientMock = vi.fn((..._args: unknown[]) => ({ mocked: true }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const { createSupabaseClient } = await import("../src/client");

describe("createSupabaseClient", () => {
  it("throws when url is missing", () => {
    expect(() => createSupabaseClient("", "anon-key")).toThrow(
      "createSupabaseClient: both url and anonKey are required"
    );
  });

  it("throws when anonKey is missing", () => {
    expect(() => createSupabaseClient("https://x.supabase.co", "")).toThrow(
      "createSupabaseClient: both url and anonKey are required"
    );
  });

  it("passes url, anonKey, and options straight through to createClient", () => {
    const options = { auth: { persistSession: false } };
    createSupabaseClient("https://x.supabase.co", "anon-key", options);
    expect(createClientMock).toHaveBeenCalledWith("https://x.supabase.co", "anon-key", options);
  });

  it("works with no options argument", () => {
    createSupabaseClient("https://x.supabase.co", "anon-key");
    expect(createClientMock).toHaveBeenCalledWith("https://x.supabase.co", "anon-key", undefined);
  });
});
