import { NextResponse } from "next/server";
import { createSupabaseClient } from "@coffeesnob/supabase";
import type { PhotoDeps, PhotoStore, Result } from "./handlers";
import { r2FromEnv } from "./r2";

// Real dependencies and the HTTP wrapper for /api/photos/*. The app calls these
// with its Supabase access token; reads run as that user (RLS applies), and only
// the final insert uses the service role, after the files have been checked.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const NO_SESSION = { persistSession: false, autoRefreshToken: false };

const asUser = (token: string) =>
  createSupabaseClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: NO_SESSION });

async function userFromToken(token: string) {
  if (!token) return null;
  const { data, error } = await asUser(token).auth.getUser(token);
  return error || !data.user ? null : { id: data.user.id };
}

function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

function store(token: string): PhotoStore {
  const db = asUser(token);
  const count = (res: { count: number | null; error: { message: string } | null }) => must({ data: res.count ?? 0, error: res.error });
  return {
    isActive: async (userId) => must(await db.from("profiles").select("status").eq("id", userId).maybeSingle())?.status === "active",
    ownsLog: async (userId, logId) => !!must(await db.from("logs").select("id").eq("id", logId).eq("user_id", userId).maybeSingle()),
    photosOnLog: async (logId) =>
      count(await db.from("log_photos").select("id", { count: "exact", head: true }).eq("log_id", logId).neq("status", "removed")),
    photosToday: async (userId) =>
      count(
        await db
          .from("log_photos")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gt("created_at", new Date(Date.now() - 24 * 3600_000).toISOString()),
      ),
    insertPhoto: async (row) => {
      const admin = createSupabaseClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: NO_SESSION });
      const { error } = await admin.from("log_photos").insert(row);
      return error ? { ok: false, message: error.message } : { ok: true };
    },
  };
}

const deps = (): PhotoDeps => ({ userFromToken, store, r2: r2FromEnv(), newId: () => crypto.randomUUID() });

// Browsers only (native apps send no Origin). Local Expo web runs on :8081.
const ORIGINS = ["https://app.coffeesnobproject.com", "http://localhost:8081"];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin || !ORIGINS.includes(origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    Vary: "Origin",
  };
}

export function photoRoute(handler: (deps: PhotoDeps, token: string, body: unknown) => Promise<Result>) {
  return {
    OPTIONS: (req: Request) => new Response(null, { status: 204, headers: cors(req) }),
    POST: async (req: Request) => {
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      const body = await req.json().catch(() => null);
      try {
        const { status, body: out } = await handler(deps(), token, body);
        return NextResponse.json(out, { status, headers: cors(req) });
      } catch (e) {
        console.error("[photos]", e);
        return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500, headers: cors(req) });
      }
    },
  };
}
