import { describe, expect, it } from "vitest";
import { makeR2 } from "./r2";

const r2 = makeR2({ accountId: "acct", bucket: "photos", accessKeyId: "AKID", secretAccessKey: "secret" });

describe("presignPut", () => {
  it("signs a short-lived PUT for the object, with its content type signed in", async () => {
    const url = new URL(await r2.presignPut("logs/l/p.webp", "image/webp"));
    expect(url.origin).toBe("https://acct.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/photos/logs/l/p.webp");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain("content-type");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });
});
