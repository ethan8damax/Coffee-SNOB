// apps/web/lib/supabase-server.ts
// Cookie-backed Supabase client for Server Components and Server Actions in the admin
// dashboard (the only part of apps/web that needs a signed-in session — the rest of the
// site is public marketing content read with the plain anon client in lib/supabase.ts).
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@coffeesnob/supabase";

export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render, which can't set cookies — the
            // middleware (Task 5) refreshes the session cookie on every request instead.
          }
        },
      },
    }
  );
}
