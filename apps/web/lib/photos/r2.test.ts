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

describe("parseList", () => {
  it("reads keys, sizes, dates and the next page token", async () => {
    const { parseList } = await import("./r2");
    const xml = `<?xml version="1.0"?><ListBucketResult><IsTruncated>true</IsTruncated><Contents><Key>logs/l/a.jpg</Key><LastModified>2026-09-30T16:39:46.000Z</LastModified><Size>433054</Size></Contents><Contents><Key>logs/l/a_t.jpg</Key><LastModified>2026-09-30T16:39:46.000Z</LastModified><Size>63293</Size></Contents><NextContinuationToken>abc+/=</NextContinuationToken></ListBucketResult>`;
    expect(parseList(xml)).toEqual({
      objects: [
        { key: "logs/l/a.jpg", size: 433054, lastModified: "2026-09-30T16:39:46.000Z" },
        { key: "logs/l/a_t.jpg", size: 63293, lastModified: "2026-09-30T16:39:46.000Z" },
      ],
      next: "abc+/=",
    });
    expect(parseList("<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>")).toEqual({ objects: [], next: null });
  });
});
