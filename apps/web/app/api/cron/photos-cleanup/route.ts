import { NextResponse } from "next/server";
import { createSupabaseClient } from "@coffeesnob/supabase";
import { runCleanup, type PhotoRowRef } from "@/lib/photos/cleanup";
import { cronAuthorized } from "@/lib/photos/cron";
import { r2FromEnv } from "@/lib/photos/r2";

// Nightly photo housekeeping (photos Phase 4 spec), scheduled in vercel.json.
// Reads every photo row with the service role, so RLS doesn't hide any.
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronAuthorized(req, process.env.CRON_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const r2 = r2FromEnv();
  // ?dry=1 reports what a run would delete, and deletes nothing.
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const summary = await runCleanup({
    list: () => r2.list("logs/"),
    // Every row, a page at a time: PostgREST caps a response at 1,000 rows, and a
    // missing row would read as an orphan.
    rows: async () => {
      const out: PhotoRowRef[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db.from("log_photos").select("path, thumb_path, status").order("id").range(from, from + 999);
        if (error) throw error;
        out.push(...data);
        if (data.length < 1000) return out;
      }
    },
    uploadsThisMonth: async () => {
      const start = new Date();
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);
      const { count, error } = await db.from("log_photos").select("id", { count: "exact", head: true }).gte("created_at", start.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    remove: (key) => (dry ? Promise.resolve() : r2.remove(key)),
    warn: (message) => console.warn(message),
    now: () => new Date(),
  });
  console.log(`[photos] cleanup${dry ? " (dry run)" : ""}`, JSON.stringify(summary));
  return NextResponse.json({ ...summary, dry });
}
