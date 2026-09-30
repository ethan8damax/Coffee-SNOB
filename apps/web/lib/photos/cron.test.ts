import { describe, expect, it, vi } from "vitest";
import { cronAuthorized } from "./cron";

describe("cronAuthorized", () => {
  it("accepts only the exact bearer secret, and nothing when no secret is set", () => {
    const req = (auth?: string) => new Request("https://x/api/cron", { headers: auth ? { authorization: auth } : {} });
    expect(cronAuthorized(req("Bearer s3cret"), "s3cret")).toBe(true);
    expect(cronAuthorized(req("Bearer nope"), "s3cret")).toBe(false);
    expect(cronAuthorized(req(), "s3cret")).toBe(false);
    expect(cronAuthorized(req("Bearer "), "")).toBe(false);
    expect(cronAuthorized(req("Bearer undefined"), undefined)).toBe(false);
    vi.restoreAllMocks();
  });
});
