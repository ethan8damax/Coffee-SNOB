import { timingSafeEqual } from "node:crypto";

// Vercel calls cron routes with `Authorization: Bearer $CRON_SECRET`. With no
// secret configured, nothing is authorized.
export function cronAuthorized(req: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}
