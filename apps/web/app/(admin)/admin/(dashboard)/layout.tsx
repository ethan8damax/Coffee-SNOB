import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase-server";

async function signOut() {
  "use server";
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/admin/sign-in");
}

// ponytail: middleware.ts is the sole access-control gate for /admin/* (per
// docs/superpowers/specs/2026-08-26-map-and-admin-dashboard-design.md). This layout is
// UI only — add a server-side re-check here if this ever needs defense-in-depth beyond
// middleware.
export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="snob-web" style={{ minHeight: "100vh" }}>
      <nav
        style={{
          display: "flex",
          gap: 20,
          alignItems: "center",
          padding: "16px 24px",
          borderBottom: "1px solid var(--rule)",
        }}
        aria-label="Admin"
      >
        <Link href="/admin" className="label">
          Dashboard
        </Link>
        <Link href="/admin/users" className="label">
          Users
        </Link>
        <form action={signOut} style={{ marginLeft: "auto" }}>
          <button type="submit" className="label" style={{ background: "none", border: "none", cursor: "pointer" }}>
            Sign out
          </button>
        </form>
      </nav>
      <main style={{ padding: 24 }}>{children}</main>
    </div>
  );
}
