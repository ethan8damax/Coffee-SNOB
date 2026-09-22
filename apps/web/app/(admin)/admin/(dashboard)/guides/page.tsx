import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getCities, getAdminCityGuides, getAdminShops, createCityGuide, updateCityGuide, getCityGuideItems, setCityGuideItems } from "@coffeesnob/supabase";

async function saveAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const fields = {
    slug: String(formData.get("slug")),
    title: String(formData.get("title")),
    cityId: String(formData.get("cityId")),
    description: String(formData.get("description") || "") || undefined,
    body: String(formData.get("body") || "") || undefined,
  };
  const shopOrder = formData.getAll("shopOrder").map(String);
  const shopIds = shopOrder.filter((sid) => formData.get(`shop_${sid}`) === "on");

  try {
    const supabase = await getSupabaseServer();
    let listId = id;
    if (id) {
      await updateCityGuide(supabase, id, fields);
    } else {
      const created = await createCityGuide(supabase, fields);
      listId = created.id;
    }
    // The riskiest step: a failure here after updateCityGuide/createCityGuide already
    // committed can leave the guide's shop list completely empty (setCityGuideItems is
    // delete-then-insert, not a transaction) — this must never fail silently, since a
    // city guide is public-facing content. Caught below and surfaced to the admin.
    await setCityGuideItems(supabase, listId, shopIds);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save guide";
    redirect(`/admin/guides?edit=${id || "new"}&error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/guides");
  redirect("/admin/guides");
}

export default async function AdminGuidesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  const { edit, error } = await searchParams;
  const supabase = await getSupabaseServer();
  const [guides, cities] = await Promise.all([getAdminCityGuides(supabase), getCities(supabase)]);

  const editingGuide = edit === "new" ? { id: "", slug: "", title: "", cityId: "", description: "", body: "" } : guides.find((g) => g.id === edit);
  const editingCityId = edit === "new" ? undefined : editingGuide?.cityId;
  const cityShops = editingCityId ? await getAdminShops(supabase, { cityId: editingCityId }) : [];
  const currentItems = editingGuide?.id ? await getCityGuideItems(supabase, editingGuide.id) : [];
  const currentShopIds = new Set(currentItems.map((i) => i.shopId));

  return (
    <div>
      <h1 className="d2">City guides</h1>
      <Link href="/admin/guides?edit=new" className="btn btn-line" style={{ marginTop: 16, display: "inline-flex" }}>
        + Add guide
      </Link>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)" }}>
            <th>Title</th>
            <th>City</th>
            <th>Shops</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {guides.map((g) => (
            <tr key={g.id} style={{ borderBottom: "1px solid var(--rule)" }}>
              <td>{g.title}</td>
              <td>{g.cityName}</td>
              <td>{g.itemCount}</td>
              <td>
                <Link href={`/admin/guides?edit=${g.id}`} className="label">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingGuide && (
        <aside
          key={editingGuide.id || "new"}
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: 420,
            background: "var(--paper)",
            borderLeft: "1px solid var(--rule)",
            padding: 24,
            overflowY: "auto",
          }}
        >
          <Link href="/admin/guides" className="label">
            Close
          </Link>
          <h2 className="d3" style={{ marginTop: 16 }}>
            {editingGuide.id ? "Edit guide" : "New guide"}
          </h2>
          {error && (
            <p className="body-sm" style={{ color: "var(--oxblood)", marginTop: 8 }}>
              {error}
            </p>
          )}
          <form key={editingGuide.id || "new"} action={saveAction} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            <input type="hidden" name="id" value={editingGuide.id} />
            <input name="slug" defaultValue={editingGuide.slug} placeholder="Slug" required style={inputStyle} />
            <input name="title" defaultValue={editingGuide.title} placeholder="Title" required style={inputStyle} />
            <select name="cityId" defaultValue={editingCityId ?? ""} required style={inputStyle}>
              <option value="" disabled>
                City
              </option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <textarea name="description" defaultValue={editingGuide.description ?? ""} placeholder="Description" rows={2} style={inputStyle} />
            <textarea name="body" defaultValue={editingGuide.body ?? ""} placeholder="Body" rows={6} style={inputStyle} />

            <h3 className="d4" style={{ marginTop: 16 }}>
              Shops in this guide
            </h3>
            {cityShops.length === 0 && <p className="body-sm">Pick a city and save once, then reopen to choose its shops.</p>}
            {cityShops.map((s) => (
              <label key={s.id} className="body-sm" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="hidden" name="shopOrder" value={s.id} />
                <input type="checkbox" name={`shop_${s.id}`} defaultChecked={currentShopIds.has(s.id)} />
                {s.name}
              </label>
            ))}

            <button type="submit" className="btn btn-ox" style={{ marginTop: 12 }}>
              Save
            </button>
          </form>
        </aside>
      )}
    </div>
  );
}

const inputStyle = { height: 40, padding: "0 10px", border: "1px solid var(--rule)", borderRadius: 2, fontFamily: "inherit" } as const;
