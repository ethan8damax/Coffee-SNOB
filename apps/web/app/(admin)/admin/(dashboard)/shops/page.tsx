import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getCities, getAdminShops, createShop, updateShop, upsertShopCuration, rejectShopPromotion } from "@coffeesnob/supabase";

async function saveAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const shopFields = {
    name: String(formData.get("name")),
    cityId: String(formData.get("cityId")),
    neighborhood: String(formData.get("neighborhood") || "") || undefined,
    lat: formData.get("lat") ? Number(formData.get("lat")) : undefined,
    lng: formData.get("lng") ? Number(formData.get("lng")) : undefined,
    address: String(formData.get("address") || "") || undefined,
    website: String(formData.get("website") || "") || undefined,
    phone: String(formData.get("phone") || "") || undefined,
    hours: String(formData.get("hours") || "") || undefined,
  };
  const supabase = await getSupabaseServer();
  let shopId = id;
  if (id) {
    await updateShop(supabase, id, shopFields);
  } else {
    const created = await createShop(supabase, shopFields);
    shopId = created.id;
  }

  const priceTier = formData.get("priceTier");
  if (priceTier) {
    await upsertShopCuration(supabase, shopId, {
      priceTier: priceTier as "€" | "€€" | "€€€",
      tag: String(formData.get("tag") || "") || undefined,
      editorialRating: formData.get("editorialRating") ? Number(formData.get("editorialRating")) : undefined,
      writeup: String(formData.get("writeup") || "") || undefined,
      orderNote: String(formData.get("orderNote") || "") || undefined,
    });
  }
  revalidatePath("/admin/shops");
}

async function rejectAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const supabase = await getSupabaseServer();
  await rejectShopPromotion(supabase, id);
  revalidatePath("/admin/shops");
}

type Filter = "all" | "flagged";

export default async function AdminShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; filter?: Filter; edit?: string }>;
}) {
  const { search, filter = "all", edit } = await searchParams;
  const supabase = await getSupabaseServer();
  const [shops, cities] = await Promise.all([getAdminShops(supabase, { search, filter }), getCities(supabase)]);
  const editing = edit === "new" ? emptyShop() : shops.find((s) => s.id === edit);

  // Preserves the current search/filter across in-page navigation (Edit, filter chips,
  // Close) — matches /admin/users' hrefWith; without this, every click after searching
  // silently drops the search text (a real bug found and fixed on that page first).
  const hrefWith = (overrides: { filter?: Filter; edit?: string }) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("filter", overrides.filter ?? filter);
    if (overrides.edit) params.set("edit", overrides.edit);
    return `/admin/shops?${params.toString()}`;
  };

  return (
    <div>
      <h1 className="d2">Shops</h1>

      <form style={{ display: "flex", gap: 12, margin: "16px 0", alignItems: "center" }}>
        <input type="hidden" name="filter" value={filter} />
        <input name="search" defaultValue={search} placeholder="Search name" style={inputStyle} />
        <button type="submit" className="btn btn-line">
          Search
        </button>
        {(["all", "flagged"] as const).map((f) => (
          <Link key={f} href={hrefWith({ filter: f })} className={`chip ${filter === f ? "on" : ""}`}>
            {f}
          </Link>
        ))}
        <Link href={hrefWith({ edit: "new" })} className="btn btn-line">
          + Add shop
        </Link>
      </form>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)" }}>
            <th>Name</th>
            <th>City</th>
            <th>Approved</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {shops.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid var(--rule)" }}>
              <td>{s.name}</td>
              <td>{cities.find((c) => c.id === s.cityId)?.name ?? "—"}</td>
              <td>{s.curation ? "Yes" : "No"}</td>
              <td>{s.promotionStatus}</td>
              <td>
                <Link href={hrefWith({ edit: s.id })} className="label">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <aside key={editing.id || "new"} style={peekStyle}>
          <Link href={hrefWith({})} className="label">
            Close
          </Link>
          <h2 className="d3" style={{ marginTop: 16 }}>
            {editing.id ? "Edit shop" : "New shop"}
          </h2>
          <form key={editing.id || "new"} action={saveAction} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            <input type="hidden" name="id" value={editing.id} />
            <input name="name" defaultValue={editing.name} placeholder="Name" required style={inputStyle} />
            <select name="cityId" defaultValue={editing.cityId ?? ""} required style={inputStyle}>
              <option value="" disabled>
                City
              </option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input name="neighborhood" defaultValue={editing.neighborhood ?? ""} placeholder="Neighborhood" style={inputStyle} />
            <input name="lat" defaultValue={editing.lat ?? ""} placeholder="Latitude" type="number" step="any" style={inputStyle} />
            <input name="lng" defaultValue={editing.lng ?? ""} placeholder="Longitude" type="number" step="any" style={inputStyle} />
            <input name="address" defaultValue={editing.address ?? ""} placeholder="Address" style={inputStyle} />
            <input name="website" defaultValue={editing.website ?? ""} placeholder="Website" style={inputStyle} />
            <input name="phone" defaultValue={editing.phone ?? ""} placeholder="Phone" style={inputStyle} />
            <input name="hours" defaultValue={editing.hours ?? ""} placeholder="Hours" style={inputStyle} />

            <h3 className="d4" style={{ marginTop: 16 }}>
              Curation (leave price tier blank to skip approving)
            </h3>
            <select name="priceTier" defaultValue={editing.curation?.priceTier ?? ""} style={inputStyle}>
              <option value="">— not curated —</option>
              <option value="€">€</option>
              <option value="€€">€€</option>
              <option value="€€€">€€€</option>
            </select>
            <input name="tag" defaultValue={editing.curation?.tag ?? ""} placeholder="Tag (e.g. Best pour-over)" style={inputStyle} />
            <input
              name="editorialRating"
              defaultValue={editing.curation?.editorialRating ?? ""}
              placeholder="Editorial rating (1-5)"
              type="number"
              min={1}
              max={5}
              style={inputStyle}
            />
            <textarea name="writeup" defaultValue={editing.curation?.writeup ?? ""} placeholder="Write-up" rows={6} style={inputStyle} />
            <input name="orderNote" defaultValue={editing.curation?.orderNote ?? ""} placeholder="What to order" style={inputStyle} />

            <button type="submit" className="btn btn-ox">
              Save
            </button>
          </form>

          {editing.id && editing.promotionStatus === "flagged" && (
            <form action={rejectAction} style={{ marginTop: 8 }}>
              <input type="hidden" name="id" value={editing.id} />
              <button type="submit" className="btn btn-line">
                Reject (not a fit)
              </button>
            </form>
          )}
        </aside>
      )}
    </div>
  );
}

function emptyShop() {
  return {
    id: "",
    name: "",
    cityId: null as string | null,
    neighborhood: null,
    lat: null,
    lng: null,
    address: null,
    website: null,
    phone: null,
    hours: null,
    promotionStatus: "none",
    curation: null,
  };
}

const inputStyle = { height: 40, padding: "0 10px", border: "1px solid var(--rule)", borderRadius: 2, fontFamily: "inherit" } as const;
const peekStyle = {
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  width: 400,
  background: "var(--paper)",
  borderLeft: "1px solid var(--rule)",
  padding: 24,
  overflowY: "auto",
} as const;
