import type { ReactNode } from "react";
import Link from "next/link";

// ponytail: middleware.ts is the sole access-control gate for /admin/* (per
// docs/superpowers/specs/2026-08-26-map-and-admin-dashboard-design.md). This layout is
// UI only — add a server-side re-check here if this ever needs defense-in-depth beyond
// middleware.
export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="snob-web" style={{ minHeight: "100vh" }}>
      <nav style={{ display: "flex", gap: 20, padding: "16px 24px", borderBottom: "1px solid var(--rule)" }}>
        <Link href="/admin" className="label">
          Dashboard
        </Link>
        <Link href="/admin/users" className="label">
          Users
        </Link>
      </nav>
      <main style={{ padding: 24 }}>{children}</main>
    </div>
  );
}
