import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getAdminUserDirectory, getProfileEntries, setUserStatus, setUserAdmin, snobStatus } from "@coffeesnob/supabase";

async function suspendAction(formData: FormData) {
  "use server";
  const targetUserId = String(formData.get("targetUserId"));
  const nextStatus = formData.get("nextStatus") === "suspended" ? "suspended" : "active";
  const supabase = await getSupabaseServer();
  await setUserStatus(supabase, targetUserId, nextStatus);
  revalidatePath("/admin/users");
}

async function adminAction(formData: FormData) {
  "use server";
  const targetUserId = String(formData.get("targetUserId"));
  const nextIsAdmin = formData.get("nextIsAdmin") === "true";
  const supabase = await getSupabaseServer();
  await setUserAdmin(supabase, targetUserId, nextIsAdmin);
  revalidatePath("/admin/users");
}

type Filter = "all" | "admins" | "suspended";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; filter?: Filter; user?: string }>;
}) {
  const { search, filter = "all", user: selectedUserId } = await searchParams;
  const supabase = await getSupabaseServer();
  const [users, currentUserResult] = await Promise.all([
    getAdminUserDirectory(supabase, { search, filter }),
    supabase.auth.getUser(),
  ]);
  const currentUserId = currentUserResult.data.user?.id;

  // Preserves the current search/filter across in-page navigation (View, filter chips,
  // Close) — without this, clicking any of them silently drops the search text.
  const hrefWith = (overrides: { filter?: Filter; user?: string }) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("filter", overrides.filter ?? filter);
    if (overrides.user) params.set("user", overrides.user);
    return `/admin/users?${params.toString()}`;
  };

  const selectedUser = selectedUserId ? users.find((u) => u.id === selectedUserId) : undefined;
  const selectedUserLogs = selectedUser ? await getProfileEntries(supabase, selectedUser.id, { limit: 10 }) : [];
  const isSelf = selectedUser?.id === currentUserId;

  return (
    <div>
      <h1 className="d2">Users</h1>

      <form style={{ display: "flex", gap: 12, margin: "16px 0", alignItems: "center" }}>
        <input type="hidden" name="filter" value={filter} />
        <input
          name="search"
          defaultValue={search}
          placeholder="Search username"
          style={{ height: 38, padding: "0 10px", border: "1px solid var(--rule)", borderRadius: 2 }}
        />
        <button type="submit" className="btn btn-line">
          Search
        </button>
        {(["all", "admins", "suspended"] as const).map((f) => (
          <Link key={f} href={hrefWith({ filter: f })} className={`chip ${filter === f ? "on" : ""}`}>
            {f}
          </Link>
        ))}
      </form>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)" }}>
            <th>Username</th>
            <th>Joined</th>
            <th>Snob tier</th>
            <th>Logs</th>
            <th>Followers</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid var(--rule)" }}>
              <td>
                {u.username}
                {u.isAdmin ? " · admin" : ""}
              </td>
              <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              <td>{snobStatus(u.logCount).name}</td>
              <td>{u.logCount}</td>
              <td>{u.followerCount}</td>
              <td>{u.status}</td>
              <td>
                <Link href={hrefWith({ user: u.id })} className="label">
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedUser && (
        <aside
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: 360,
            background: "var(--paper)",
            borderLeft: "1px solid var(--rule)",
            padding: 24,
            overflowY: "auto",
          }}
        >
          <Link href={hrefWith({})} className="label">
            Close
          </Link>
          <h2 className="d3" style={{ marginTop: 16 }}>
            {selectedUser.username}
          </h2>
          <p className="body">Joined {new Date(selectedUser.createdAt).toLocaleDateString()}</p>
          <p className="body">
            {snobStatus(selectedUser.logCount).name} · {selectedUser.logCount} logs · {selectedUser.followerCount} followers
          </p>
          <p className="body">Status: {selectedUser.status}</p>

          {isSelf ? (
            <p className="body-sm" style={{ marginTop: 16, color: "var(--oxblood)" }}>
              This is your own account — suspend/revoke-admin are disabled here to prevent
              accidentally locking yourself (or everyone, if you're the only admin) out.
            </p>
          ) : (
            <>
              <form action={suspendAction} style={{ marginTop: 16 }}>
                <input type="hidden" name="targetUserId" value={selectedUser.id} />
                <input type="hidden" name="nextStatus" value={selectedUser.status === "active" ? "suspended" : "active"} />
                <button type="submit" className="btn btn-line">
                  {selectedUser.status === "active" ? "Suspend" : "Reactivate"}
                </button>
              </form>

              <form action={adminAction} style={{ marginTop: 8 }}>
                <input type="hidden" name="targetUserId" value={selectedUser.id} />
                <input type="hidden" name="nextIsAdmin" value={(!selectedUser.isAdmin).toString()} />
                <button type="submit" className="btn btn-line">
                  {selectedUser.isAdmin ? "Revoke admin" : "Grant admin"}
                </button>
              </form>
            </>
          )}

          <h3 className="d4" style={{ marginTop: 24 }}>
            Recent activity
          </h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {selectedUserLogs.map((entry) => (
              <li key={entry.id} className="body-sm" style={{ borderBottom: "1px solid var(--rule)", padding: "8px 0" }}>
                {entry.shopName} · {entry.rating}★ · {entry.visitedAt}
              </li>
            ))}
            {selectedUserLogs.length === 0 && <li className="body-sm">No activity yet.</li>}
          </ul>
        </aside>
      )}
    </div>
  );
}
