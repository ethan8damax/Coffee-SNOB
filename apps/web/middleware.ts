// apps/web/middleware.ts
// Gates /admin/* on a signed-in user with is_admin = true, per
// docs/superpowers/specs/2026-08-26-map-and-admin-dashboard-design.md ("Next.js middleware
// on the (admin) route group checks the session's is_admin flag and redirects non-admins
// before any admin page renders"). /admin/sign-in is excluded so signing in doesn't loop.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@coffeesnob/supabase";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  if (!request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname === "/admin/sign-in") {
    return response;
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/admin/sign-in", request.url));
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
