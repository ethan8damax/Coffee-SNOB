import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase-server";

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/admin/sign-in?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/admin");
}

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="snob-web" style={{ maxWidth: 360, margin: "80px auto", padding: "0 24px" }}>
      <h1 className="d2">Admin sign in</h1>
      {error && (
        <p className="body" style={{ color: "var(--oxblood)", marginTop: 12 }}>
          {error}
        </p>
      )}
      <form action={signIn} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          style={{ height: 46, padding: "0 12px", border: "1px solid var(--rule)", borderRadius: 2 }}
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          style={{ height: 46, padding: "0 12px", border: "1px solid var(--rule)", borderRadius: 2 }}
        />
        <button type="submit" className="btn btn-ox">
          Sign in
        </button>
      </form>
    </div>
  );
}
