import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getCities, createCity, updateCity } from "@coffeesnob/supabase";

async function saveAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const fields = {
    slug: String(formData.get("slug")),
    name: String(formData.get("name")),
    country: String(formData.get("country")),
    region: String(formData.get("region")),
    status: String(formData.get("status")) as "live" | "coming_soon" | "demo",
  };
  const supabase = await getSupabaseServer();
  if (id) {
    await updateCity(supabase, id, fields);
  } else {
    await createCity(supabase, fields);
  }
  revalidatePath("/admin/cities");
}

export default async function AdminCitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const supabase = await getSupabaseServer();
  const cities = await getCities(supabase);
  const editing = edit === "new" ? { id: "", slug: "", name: "", country: "", region: "", status: "coming_soon" } : cities.find((c) => c.id === edit);

  return (
    <div>
      <h1 className="d2">Cities</h1>
      <Link href="/admin/cities?edit=new" className="btn btn-line" style={{ marginTop: 16, display: "inline-flex" }}>
        + Add city
      </Link>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)" }}>
            <th>Name</th>
            <th>Country</th>
            <th>Region</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {cities.map((c) => (
            <tr key={c.id} style={{ borderBottom: "1px solid var(--rule)" }}>
              <td>{c.name}</td>
              <td>{c.country}</td>
              <td>{c.region}</td>
              <td>{c.status}</td>
              <td>
                <Link href={`/admin/cities?edit=${c.id}`} className="label">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
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
          <Link href="/admin/cities" className="label">
            Close
          </Link>
          <h2 className="d3" style={{ marginTop: 16 }}>
            {editing.id ? "Edit city" : "New city"}
          </h2>
          <form
            key={editing.id || "new"}
            action={saveAction}
            style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}
          >
            <input type="hidden" name="id" value={editing.id} />
            <input name="slug" defaultValue={editing.slug} placeholder="Slug" required style={inputStyle} />
            <input name="name" defaultValue={editing.name} placeholder="Name" required style={inputStyle} />
            <input name="country" defaultValue={editing.country} placeholder="Country" required style={inputStyle} />
            <input name="region" defaultValue={editing.region} placeholder="Region" required style={inputStyle} />
            <select name="status" defaultValue={editing.status} style={inputStyle}>
              <option value="coming_soon">Coming soon</option>
              <option value="live">Live</option>
              <option value="demo">Demo</option>
            </select>
            <button type="submit" className="btn btn-ox">
              Save
            </button>
          </form>
        </aside>
      )}
    </div>
  );
}

const inputStyle = { height: 40, padding: "0 10px", border: "1px solid var(--rule)", borderRadius: 2 } as const;
