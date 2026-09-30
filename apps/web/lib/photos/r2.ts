import { AwsClient } from "aws4fetch";
import { PHOTO_LIMITS } from "@coffeesnob/supabase";

// The photos bucket on Cloudflare R2, through its S3 API. Keys stay server-side;
// the phone only ever sees short-lived presigned PUT URLs.
export type R2Config = { accountId: string; bucket: string; accessKeyId: string; secretAccessKey: string };

export function makeR2(cfg: R2Config) {
  const aws = new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, service: "s3", region: "auto" });
  const url = (key: string) => `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${key}`;

  return {
    async presignPut(key: string, contentType: string): Promise<string> {
      const u = new URL(url(key));
      u.searchParams.set("X-Amz-Expires", String(PHOTO_LIMITS.signedUrlSeconds));
      const signed = await aws.sign(new Request(u, { method: "PUT", headers: { "content-type": contentType } }), {
        aws: { signQuery: true, allHeaders: true },
      });
      return signed.url;
    },
    async head(key: string): Promise<{ size: number; contentType: string } | null> {
      const res = await aws.fetch(url(key), { method: "HEAD" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`R2 HEAD ${res.status}`);
      return { size: Number(res.headers.get("content-length") ?? 0), contentType: res.headers.get("content-type") ?? "" };
    },
    async readStart(key: string, bytes: number): Promise<Uint8Array> {
      const res = await aws.fetch(url(key), { headers: { range: `bytes=0-${bytes - 1}` } });
      if (!res.ok) throw new Error(`R2 GET ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
    // Every object under a prefix, following continuation tokens.
    async list(prefix: string) {
      const out: { key: string; size: number; lastModified: string }[] = [];
      let token: string | null = null;
      do {
        const u = new URL(`https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}`);
        u.searchParams.set("list-type", "2");
        u.searchParams.set("prefix", prefix);
        if (token) u.searchParams.set("continuation-token", token);
        const res = await aws.fetch(u.toString());
        if (!res.ok) throw new Error(`R2 LIST ${res.status}`);
        const page = parseList(await res.text());
        out.push(...page.objects);
        token = page.next;
      } while (token);
      return out;
    },
    async remove(key: string): Promise<void> {
      const res = await aws.fetch(url(key), { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE ${res.status}`);
    },
  };
}

export type R2 = ReturnType<typeof makeR2>;

// One page of an S3 ListObjectsV2 response. Our keys are UUID paths, so the
// only XML escape that can appear is &amp;.
export function parseList(xml: string): { objects: { key: string; size: number; lastModified: string }[]; next: string | null } {
  const tag = (s: string, name: string) => s.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? null;
  const objects = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(([, c]) => ({
    key: (tag(c, "Key") ?? "").replace(/&amp;/g, "&"),
    size: Number(tag(c, "Size") ?? 0),
    lastModified: tag(c, "LastModified") ?? "",
  }));
  return { objects, next: tag(xml, "IsTruncated") === "true" ? tag(xml, "NextContinuationToken") : null };
}

export function r2FromEnv(): R2 {
  const { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) throw new Error("R2 env vars are missing");
  return makeR2({ accountId: R2_ACCOUNT_ID, bucket: R2_BUCKET, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY });
}
