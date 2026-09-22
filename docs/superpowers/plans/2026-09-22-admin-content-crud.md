# Admin Content CRUD (Cities, Shops, City Guides) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin pages for `2026-08-26-map-and-admin-dashboard-design.md`'s first scope item — cities, shops (with curation), and city guides — replacing hand-edited `supabase/seed.sql` as the only way to add content. This is "shop management" and "city guide management" from the user's stated priority order; they're the same underlying spec.

**Architecture:** No new migration — `is_admin()`-gated RLS on `cities`/`shops`/`lists`/`list_items` already exists (migration `0018_admin_foundation.sql`), and `shop_curations`/`admin_actions`-adjacent tables already have full generated types. Three new admin pages under the existing `(dashboard)` route group, each following the established pattern from `/admin/users`: server-rendered, `searchParams`-driven, plain `<form>` Server Actions, no client JS. New query functions in `packages/supabase/src/queries.ts` for creates/updates (only reads existed before this).

**Tech Stack:** Same as prior admin work — Postgres/Supabase, `@coffeesnob/supabase`, Next.js Server Actions, Vitest.

**Depends on:** `2026-09-22-admin-dashboard-foundation.md` (route group, middleware, layout — already merged).

**Scope decision (confirmed with user):** shop lat/lng is manual entry only — no geocoding integration. The original spec mentioned Mapbox Geocoding, but Mapbox isn't in this repo; building a geocoder is deferred as unneeded convenience (YAGNI) until manual entry is a real friction point.

**A shop's "Snob-Approved" status is derived, not stored:** per `shop_ratings` view (`0010_shop_ratings_view.sql`), a shop is approved exactly when it has a `shop_curations` row. So "approve a flagged shop" = create its `shop_curations` row; "reject" = set `shops.promotion_status = 'rejected'`. There is no separate approval flag to manage.

**Out of scope (deferred to a later plan, per the user's stated ordering — "the rest"):** the reported-logs moderation queue and the `partners` affiliate-tracking table, both also in the original spec but not part of "shop management"/"city guide management" as the user named them.

---

### Task 1: Query functions — cities

**Files:**
- Modify: `packages/supabase/src/queries.ts`
- Modify: `packages/supabase/src/index.ts`
- Modify: `packages/supabase/test/queries.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the top-level import in `packages/supabase/test/queries.test.ts`:
```ts
import { createCity, updateCity } from "../src/queries";
```

Append:
```ts
describe("createCity", () => {
  it("inserts a city and returns it", async () => {
    const client = {
      from: () => ({
        insert: (payload: unknown) => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: "c1", ...(payload as object) }, error: null }),
          }),
        }),
      }),
    } as any;
    const city = await createCity(client, { slug: "lisbon", name: "Lisbon", country: "Portugal", region: "Europe" });
    expect(city).toEqual({ id: "c1", slug: "lisbon", name: "Lisbon", country: "Portugal", region: "Europe" });
  });

  it("throws when the client returns an error", async () => {
    const client = {
      from: () => ({
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: new Error("boom") }) }) }),
      }),
    } as any;
    await expect(createCity(client, { slug: "x", name: "X", country: "X", region: "X" })).rejects.toThrow("boom");
  });
});

describe("updateCity", () => {
  it("updates only the given fields", async () => {
    const calls: unknown[] = [];
    const client = {
      from: () => ({
        update: (payload: unknown) => {
          calls.push(payload);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
    } as any;
    await updateCity(client, "c1", { status: "live" });
    expect(calls).toEqual([{ status: "live" }]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/supabase && pnpm test`
Expected: FAIL — `createCity`/`updateCity` not exported.

- [ ] **Step 3: Implement**

Add to `packages/supabase/src/queries.ts`, near `getCities`:

```ts
export type CityFields = { slug: string; name: string; country: string; region: string; status?: "live" | "coming_soon" | "demo" };

export async function createCity(client: Client, fields: CityFields) {
  const { data, error } = await client.from("cities").insert(fields).select().single();
  if (error) throw error;
  return data;
}

export async function updateCity(client: Client, id: string, fields: Partial<CityFields>): Promise<void> {
  const { error } = await client.from("cities").update(fields).eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 4: Export**

In `packages/supabase/src/index.ts`, add `createCity, updateCity` to the queries export list and `export type { CityFields } from "./queries";`.

- [ ] **Step 5: Run to verify pass**

Run: `cd packages/supabase && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/supabase/src/queries.ts packages/supabase/src/index.ts packages/supabase/test/queries.test.ts
git commit -F - <<'EOF'
feat: add createCity, updateCity

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01A3MEERUXZQ7Dc2xr2reZ64
EOF
```

---

### Task 2: Query functions — shops and shop curation

**Files:**
- Modify: `packages/supabase/src/queries.ts`
- Modify: `packages/supabase/src/index.ts`
- Modify: `packages/supabase/test/queries.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the test file's import:
```ts
import { createShop, updateShop, upsertShopCuration, rejectShopPromotion, getAdminShops } from "../src/queries";
```

Append:
```ts
describe("createShop", () => {
  it("inserts a shop and returns it", async () => {
    const client = {
      from: () => ({
        insert: (payload: unknown) => ({
          select: () => ({ single: () => Promise.resolve({ data: { id: "s1", ...(payload as object) }, error: null }) }),
        }),
      }),
    } as any;
    const shop = await createShop(client, { name: "Corvo", cityId: "c1", neighborhood: "Alcântara", lat: 38.7, lng: -9.17 });
    expect(shop).toMatchObject({ id: "s1", name: "Corvo" });
  });
});

describe("updateShop", () => {
  it("updates only the given fields", async () => {
    const calls: unknown[] = [];
    const client = {
      from: () => ({
        update: (payload: unknown) => {
          calls.push(payload);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
    } as any;
    await updateShop(client, "s1", { website: "https://corvo.pt" });
    expect(calls).toEqual([{ website: "https://corvo.pt" }]);
  });
});

describe("upsertShopCuration", () => {
  it("upserts the curation row keyed on shop_id", async () => {
    const calls: unknown[] = [];
    const client = {
      from: (table: string) => ({
        upsert: (payload: unknown) => {
          calls.push({ table, payload });
          return Promise.resolve({ error: null });
        },
      }),
    } as any;
    await upsertShopCuration(client, "s1", { priceTier: "€€", tag: "Best pour-over", editorialRating: 5, writeup: "..." });
    expect(calls).toEqual([
      {
        table: "shop_curations",
        payload: { shop_id: "s1", price_tier: "€€", tag: "Best pour-over", editorial_rating: 5, writeup: "...", order_note: undefined },
      },
    ]);
  });
});

describe("rejectShopPromotion", () => {
  it("sets promotion_status to rejected", async () => {
    const calls: unknown[] = [];
    const client = {
      from: () => ({
        update: (payload: unknown) => {
          calls.push(payload);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
    } as any;
    await rejectShopPromotion(client, "s1");
    expect(calls).toEqual([{ promotion_status: "rejected" }]);
  });
});

describe("getAdminShops", () => {
  function fakeShopsClient(rows: unknown[]) {
    const builder: any = {
      select: () => builder,
      order: () => builder,
      ilike: () => builder,
      eq: () => builder,
      then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: rows, error: null }),
    };
    return { from: () => builder } as any;
  }

  it("maps rows including nested curation", async () => {
    const client = fakeShopsClient([
      {
        id: "s1",
        name: "Corvo",
        city_id: "c1",
        neighborhood: "Alcântara",
        lat: 38.7,
        lng: -9.17,
        address: null,
        website: null,
        phone: null,
        hours: null,
        promotion_status: "flagged",
        shop_curations: null,
      },
    ]);
    const shops = await getAdminShops(client);
    expect(shops).toEqual([
      {
        id: "s1",
        name: "Corvo",
        cityId: "c1",
        neighborhood: "Alcântara",
        lat: 38.7,
        lng: -9.17,
        address: null,
        website: null,
        phone: null,
        hours: null,
        promotionStatus: "flagged",
        curation: null,
      },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/supabase && pnpm test` — expect FAIL (functions not exported).

- [ ] **Step 3: Implement**

```ts
export type ShopFields = {
  name: string;
  cityId: string;
  neighborhood?: string;
  lat?: number;
  lng?: number;
  address?: string;
  website?: string;
  phone?: string;
  hours?: string;
};

export async function createShop(client: Client, fields: ShopFields) {
  const { data, error } = await client
    .from("shops")
    .insert({
      name: fields.name,
      city_id: fields.cityId,
      neighborhood: fields.neighborhood ?? null,
      lat: fields.lat ?? null,
      lng: fields.lng ?? null,
      address: fields.address ?? null,
      website: fields.website ?? null,
      phone: fields.phone ?? null,
      hours: fields.hours ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateShop(client: Client, id: string, fields: Partial<ShopFields>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (fields.name !== undefined) update.name = fields.name;
  if (fields.cityId !== undefined) update.city_id = fields.cityId;
  if (fields.neighborhood !== undefined) update.neighborhood = fields.neighborhood;
  if (fields.lat !== undefined) update.lat = fields.lat;
  if (fields.lng !== undefined) update.lng = fields.lng;
  if (fields.address !== undefined) update.address = fields.address;
  if (fields.website !== undefined) update.website = fields.website;
  if (fields.phone !== undefined) update.phone = fields.phone;
  if (fields.hours !== undefined) update.hours = fields.hours;
  const { error } = await client.from("shops").update(update).eq("id", id);
  if (error) throw error;
}

export type ShopCurationFields = {
  priceTier: "€" | "€€" | "€€€";
  tag?: string;
  editorialRating?: number;
  writeup?: string;
  orderNote?: string;
};

// A shop is "Snob-Approved" exactly when it has a shop_curations row (see shop_ratings
// view) — this function IS the approval action, not a separate flag flip.
export async function upsertShopCuration(client: Client, shopId: string, fields: ShopCurationFields): Promise<void> {
  const { error } = await client.from("shop_curations").upsert({
    shop_id: shopId,
    price_tier: fields.priceTier,
    tag: fields.tag,
    editorial_rating: fields.editorialRating,
    writeup: fields.writeup,
    order_note: fields.orderNote,
  });
  if (error) throw error;
}

export async function rejectShopPromotion(client: Client, shopId: string): Promise<void> {
  const { error } = await client.from("shops").update({ promotion_status: "rejected" }).eq("id", shopId);
  if (error) throw error;
}

export type AdminShopRow = {
  id: string;
  name: string;
  cityId: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  hours: string | null;
  promotionStatus: string;
  curation: { priceTier: string; tag: string | null; editorialRating: number | null; writeup: string | null; orderNote: string | null } | null;
};

export async function getAdminShops(
  client: Client,
  opts?: { search?: string; cityId?: string; filter?: "all" | "flagged" | "approved" }
): Promise<AdminShopRow[]> {
  let query = client
    .from("shops")
    .select("id, name, city_id, neighborhood, lat, lng, address, website, phone, hours, promotion_status, shop_curations(price_tier, tag, editorial_rating, writeup, order_note)")
    .order("name");
  const q = opts?.search?.trim().toLowerCase().replace(/[%_\\]/g, "");
  if (q) query = query.ilike("name", `%${q}%`);
  if (opts?.cityId) query = query.eq("city_id", opts.cityId);
  if (opts?.filter === "flagged") query = query.eq("promotion_status", "flagged");
  const { data, error } = await query;
  if (error) throw error;
  return data.map((r: any) => ({
    id: r.id,
    name: r.name,
    cityId: r.city_id,
    neighborhood: r.neighborhood,
    lat: r.lat,
    lng: r.lng,
    address: r.address,
    website: r.website,
    phone: r.phone,
    hours: r.hours,
    promotionStatus: r.promotion_status,
    curation: Array.isArray(r.shop_curations) ? (r.shop_curations[0] ?? null) : r.shop_curations
      ? {
          priceTier: r.shop_curations.price_tier,
          tag: r.shop_curations.tag,
          editorialRating: r.shop_curations.editorial_rating,
          writeup: r.shop_curations.writeup,
          orderNote: r.shop_curations.order_note,
        }
      : null,
  }));
}
```

**Note on the `filter === "flagged"` test not being in the tests above:** the hand-rolled `fakeShopsClient` doesn't distinguish filter branches (it ignores call args and always resolves the same rows) — this matches the existing test style for other filtered list functions in this file (e.g. `getAdminUserDirectory`'s tests only cover the unfiltered shape too). Don't over-build the test mock to verify every filter branch; that's what the live-DB verification step in Task 5 is for.

- [ ] **Step 4: Export**

In `packages/supabase/src/index.ts`: add `createShop, updateShop, upsertShopCuration, rejectShopPromotion, getAdminShops` and `export type { ShopFields, ShopCurationFields, AdminShopRow } from "./queries";`.

- [ ] **Step 5: Run to verify pass, then commit**

```bash
cd packages/supabase && pnpm test && pnpm typecheck
git add packages/supabase/src/queries.ts packages/supabase/src/index.ts packages/supabase/test/queries.test.ts
git commit -F - <<'EOF'
feat: add createShop, updateShop, upsertShopCuration, rejectShopPromotion, getAdminShops

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01A3MEERUXZQ7Dc2xr2reZ64
EOF
```

---

### Task 3: Query functions — city guides (lists) and their shop items

**Files:**
- Modify: `packages/supabase/src/queries.ts`
- Modify: `packages/supabase/src/index.ts`
- Modify: `packages/supabase/test/queries.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { createCityGuide, updateCityGuide, getCityGuideItems, setCityGuideItems } from "../src/queries";
```

```ts
describe("createCityGuide", () => {
  it("inserts a list with type city_guide", async () => {
    const calls: unknown[] = [];
    const client = {
      from: () => ({
        insert: (payload: unknown) => {
          calls.push(payload);
          return { select: () => ({ single: () => Promise.resolve({ data: { id: "l1" }, error: null }) }) };
        },
      }),
    } as any;
    await createCityGuide(client, { slug: "lisbon", title: "Lisbon", cityId: "c1" });
    expect(calls).toEqual([{ type: "city_guide", slug: "lisbon", title: "Lisbon", city_id: "c1", description: undefined, body: undefined, cover_photo_alt: undefined }]);
  });
});

describe("updateCityGuide", () => {
  it("updates only the given fields", async () => {
    const calls: unknown[] = [];
    const client = {
      from: () => ({
        update: (payload: unknown) => {
          calls.push(payload);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
    } as any;
    await updateCityGuide(client, "l1", { title: "New Title" });
    expect(calls).toEqual([{ title: "New Title" }]);
  });
});

describe("getCityGuideItems", () => {
  it("returns ordered items with shop names", async () => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      order: () => Promise.resolve({
        data: [{ id: "li1", shop_id: "s1", position: 0, note: null, shops: { name: "Corvo" } }],
        error: null,
      }),
    };
    const client = { from: () => builder } as any;
    const items = await getCityGuideItems(client, "l1");
    expect(items).toEqual([{ id: "li1", shopId: "s1", shopName: "Corvo", position: 0, note: null }]);
  });
});

describe("setCityGuideItems", () => {
  it("replaces all items for the list in position order", async () => {
    const calls: { table: string; op: string; payload?: unknown }[] = [];
    const client = {
      from: (table: string) => ({
        delete: () => ({
          eq: () => {
            calls.push({ table, op: "delete" });
            return Promise.resolve({ error: null });
          },
        }),
        insert: (payload: unknown) => {
          calls.push({ table, op: "insert", payload });
          return Promise.resolve({ error: null });
        },
      }),
    } as any;
    await setCityGuideItems(client, "l1", ["s1", "s2"]);
    expect(calls).toEqual([
      { table: "list_items", op: "delete" },
      {
        table: "list_items",
        op: "insert",
        payload: [
          { list_id: "l1", shop_id: "s1", position: 0 },
          { list_id: "l1", shop_id: "s2", position: 1 },
        ],
      },
    ]);
  });

  it("does nothing more after delete when the new list is empty", async () => {
    const calls: { table: string; op: string }[] = [];
    const client = {
      from: (table: string) => ({
        delete: () => ({
          eq: () => {
            calls.push({ table, op: "delete" });
            return Promise.resolve({ error: null });
          },
        }),
        insert: () => {
          calls.push({ table, op: "insert" });
          return Promise.resolve({ error: null });
        },
      }),
    } as any;
    await setCityGuideItems(client, "l1", []);
    expect(calls).toEqual([{ table: "list_items", op: "delete" }]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `cd packages/supabase && pnpm test`.

- [ ] **Step 3: Implement**

```ts
export type CityGuideFields = { slug: string; title: string; cityId: string; description?: string; body?: string; coverPhotoAlt?: string };

export async function createCityGuide(client: Client, fields: CityGuideFields) {
  const { data, error } = await client
    .from("lists")
    .insert({
      type: "city_guide",
      slug: fields.slug,
      title: fields.title,
      city_id: fields.cityId,
      description: fields.description,
      body: fields.body,
      cover_photo_alt: fields.coverPhotoAlt,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCityGuide(
  client: Client,
  id: string,
  fields: Partial<Omit<CityGuideFields, "cityId">> & { cityId?: string }
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (fields.slug !== undefined) update.slug = fields.slug;
  if (fields.title !== undefined) update.title = fields.title;
  if (fields.cityId !== undefined) update.city_id = fields.cityId;
  if (fields.description !== undefined) update.description = fields.description;
  if (fields.body !== undefined) update.body = fields.body;
  if (fields.coverPhotoAlt !== undefined) update.cover_photo_alt = fields.coverPhotoAlt;
  const { error } = await client.from("lists").update(update).eq("id", id);
  if (error) throw error;
}

export type CityGuideItem = { id: string; shopId: string; shopName: string; position: number; note: string | null };

export async function getCityGuideItems(client: Client, listId: string): Promise<CityGuideItem[]> {
  const { data, error } = await client
    .from("list_items")
    .select("id, shop_id, position, note, shops(name)")
    .eq("list_id", listId)
    .order("position");
  if (error) throw error;
  return data.map((r: any) => ({
    id: r.id,
    shopId: r.shop_id,
    shopName: r.shops.name,
    position: r.position,
    note: r.note,
  }));
}

// Replace-all rather than diff/patch: an admin's guide-editor form always submits the
// full ordered shop list, and a city guide has at most a handful of shops (the curation
// standard is 5-10 per city) — a delete+reinsert is simpler than computing a diff and
// costs nothing at this scale. Not wrapped in a transaction/RPC (unlike the user-
// management audit writes): a partial failure here just leaves a content page
// temporarily short some shops, recoverable by re-saving — not a security or audit
// concern, so the extra atomicity isn't worth a new RPC for this.
export async function setCityGuideItems(client: Client, listId: string, shopIds: string[]): Promise<void> {
  const { error: deleteError } = await client.from("list_items").delete().eq("list_id", listId);
  if (deleteError) throw deleteError;
  if (shopIds.length === 0) return;
  const { error: insertError } = await client.from("list_items").insert(
    shopIds.map((shopId, position) => ({ list_id: listId, shop_id: shopId, position }))
  );
  if (insertError) throw insertError;
}
```

- [ ] **Step 4: Export**

In `packages/supabase/src/index.ts`: add `createCityGuide, updateCityGuide, getCityGuideItems, setCityGuideItems` and `export type { CityGuideFields, CityGuideItem } from "./queries";`.

- [ ] **Step 5: Run to verify pass, then commit**

```bash
cd packages/supabase && pnpm test && pnpm typecheck
git add packages/supabase/src/queries.ts packages/supabase/src/index.ts packages/supabase/test/queries.test.ts
git commit -F - <<'EOF'
feat: add createCityGuide, updateCityGuide, getCityGuideItems, setCityGuideItems

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01A3MEERUXZQ7Dc2xr2reZ64
EOF
```

---

### Task 4: `/admin/cities` page

**Files:**
- Create: `apps/web/app/(admin)/admin/(dashboard)/cities/page.tsx`
- Modify: `apps/web/app/(admin)/admin/(dashboard)/layout.tsx` (add nav link)

- [ ] **Step 1: Add the nav link**

In the layout's `<nav>`, add a link between "Users" and the sign-out form:
```tsx
<Link href="/admin/cities" className="label">
  Cities
</Link>
<Link href="/admin/shops" className="label">
  Shops
</Link>
<Link href="/admin/guides" className="label">
  Guides
</Link>
```

- [ ] **Step 2: Write the page**

A single page doing both list and inline create/edit — no separate "new" route, matching this dashboard's existing minimal-pages style. Editing a row opens it via `?edit=<id>`, same `searchParams`-driven pattern as `/admin/users`' `?user=<id>` peek.

```tsx
// apps/web/app/(admin)/admin/(dashboard)/cities/page.tsx
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
          <form action={saveAction} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
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
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm typecheck` — expect no errors. `getCities` already exists and returns `{id, slug, name, country, region, status}` per `packages/supabase/src/queries.ts` — confirm this before relying on it.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(admin)/admin/(dashboard)/cities" "apps/web/app/(admin)/admin/(dashboard)/layout.tsx"
git commit -F - <<'EOF'
feat: add admin cities page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01A3MEERUXZQ7Dc2xr2reZ64
EOF
```

---

### Task 5: `/admin/shops` page

**Files:**
- Create: `apps/web/app/(admin)/admin/(dashboard)/shops/page.tsx`

- [ ] **Step 1: Write the page**

Same list+peek pattern as cities, plus: a city filter, a "Flagged" filter chip (shops with `promotion_status = 'flagged'`, i.e. auto-flagged for promotion review per `0009_shop_promotion_trigger.sql`), the curation fields in the edit form, and a "Reject" button shown only when the shop is flagged.

```tsx
// apps/web/app/(admin)/admin/(dashboard)/shops/page.tsx
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
          <Link key={f} href={`/admin/shops?filter=${f}${search ? `&search=${encodeURIComponent(search)}` : ""}`} className={`chip ${filter === f ? "on" : ""}`}>
            {f}
          </Link>
        ))}
        <Link href="/admin/shops?edit=new" className="btn btn-line">
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
                <Link href={`/admin/shops?filter=${filter}&edit=${s.id}`} className="label">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <aside style={peekStyle}>
          <Link href={`/admin/shops?filter=${filter}`} className="label">
            Close
          </Link>
          <h2 className="d3" style={{ marginTop: 16 }}>
            {editing.id ? "Edit shop" : "New shop"}
          </h2>
          <form action={saveAction} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
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
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm typecheck`. Before trusting the code above verbatim, confirm `getCities`' actual return shape (`{id, slug, name, country, region, status}`) matches its use here (`cities.find(c => c.id === s.cityId)?.name`) — read `packages/supabase/src/queries.ts` yourself first.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(admin)/admin/(dashboard)/shops"
git commit -F - <<'EOF'
feat: add admin shops page (with curation and flagged-review workflow)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01A3MEERUXZQ7Dc2xr2reZ64
EOF
```

---

### Task 6: `/admin/guides` page (city guides + shop picker)

**Files:**
- Create: `apps/web/app/(admin)/admin/(dashboard)/guides/page.tsx`

- [ ] **Step 1: Write the page**

List of `lists` where `type = 'city_guide'` (reuse `getCities` for the city dropdown and `getAdminShops` — filtered to the editing guide's city — for the shop picker). The shop picker is a checklist (checkboxes), submitted as an array of shop ids in a fixed order (the order the admin checks them isn't preserved by HTML checkboxes — see the note below).

```tsx
// apps/web/app/(admin)/admin/(dashboard)/guides/page.tsx
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getCities, getCitiesWithShopCounts, getAdminShops, createCityGuide, updateCityGuide, getCityGuideItems, setCityGuideItems } from "@coffeesnob/supabase";

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
  const supabase = await getSupabaseServer();
  let listId = id;
  if (id) {
    await updateCityGuide(supabase, id, fields);
  } else {
    const created = await createCityGuide(supabase, fields);
    listId = created.id;
  }
  // Order is the order shop ids were appended to the form — see the ordered hidden-input
  // trick in the shop-picker JSX below (checkboxes alone don't preserve check order).
  const shopIds = formData.getAll("shopOrder").map(String).filter((id2) => formData.get(`shop_${id2}`) === "on");
  await setCityGuideItems(supabase, listId, shopIds);
  revalidatePath("/admin/guides");
}

export default async function AdminGuidesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const supabase = await getSupabaseServer();
  const [guides, cities] = await Promise.all([getCitiesWithShopCounts(supabase), getCities(supabase)]);
  // getCitiesWithShopCounts is a per-city summary, not the guides list itself — see Step 2
  // below, this needs a real getCityGuides-shaped read; adjust before relying on this.

  return <div>{/* see Step 2 */}</div>;
}
```

- [ ] **Step 2: Stop — this needs one more read function first**

While writing this page, it becomes clear there's no existing function that lists ALL `city_guide` lists with their city name and item count for an admin table (only `getLiveCityGuides`, which filters to `status = 'live'` cities and is public-facing). Add this to `packages/supabase/src/queries.ts` before finishing the page:

```ts
export type AdminCityGuideRow = { id: string; slug: string; title: string; cityId: string; cityName: string; itemCount: number };

export async function getAdminCityGuides(client: Client): Promise<AdminCityGuideRow[]> {
  const { data, error } = await client
    .from("lists")
    .select("id, slug, title, city_id, cities(name), list_items(count)")
    .eq("type", "city_guide")
    .order("title");
  if (error) throw error;
  return data.map((r: any) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    cityId: r.city_id,
    cityName: r.cities?.name ?? "—",
    itemCount: r.list_items[0]?.count ?? 0,
  }));
}
```
Add a test for it in `packages/supabase/test/queries.test.ts` (follow the `getCitiesWithShopCounts` test in the same file for the nested-select mock pattern), export it from `index.ts`, then use `getAdminCityGuides` (not `getCitiesWithShopCounts`) as this page's list source. Commit this addition together with the page in Task 6's commit — it's part of the same page, not a separate task.

- [ ] **Step 3: Finish the page**

```tsx
// apps/web/app/(admin)/admin/(dashboard)/guides/page.tsx
import Link from "next/link";
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
  const supabase = await getSupabaseServer();
  let listId = id;
  if (id) {
    await updateCityGuide(supabase, id, fields);
  } else {
    const created = await createCityGuide(supabase, fields);
    listId = created.id;
  }
  const shopOrder = formData.getAll("shopOrder").map(String);
  const shopIds = shopOrder.filter((sid) => formData.get(`shop_${sid}`) === "on");
  await setCityGuideItems(supabase, listId, shopIds);
  revalidatePath("/admin/guides");
}

export default async function AdminGuidesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
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
          <form action={saveAction} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
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
            <textarea name="description" placeholder="Description" rows={2} style={inputStyle} />
            <textarea name="body" placeholder="Body" rows={6} style={inputStyle} />

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
```

**Known v1 limitation, acceptable per this plan's scope:** the shop order saved is the city's shop list order (from `getAdminShops`, alphabetical by name), not a custom drag-order — an admin can pick WHICH shops are in a guide but not reorder them relative to each other from this form. `setCityGuideItems` supports arbitrary order (it takes an ordered array), so custom ordering can be added later (e.g. numbered inputs, or drag-and-drop) without changing the query layer — this page just doesn't build that UI yet. Note this as a known gap, don't silently ship it as if ordering were fully supported.

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && pnpm typecheck`.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(admin)/admin/(dashboard)/guides" packages/supabase/src/queries.ts packages/supabase/src/index.ts packages/supabase/test/queries.test.ts
git commit -F - <<'EOF'
feat: add admin city guides page (with shop picker)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01A3MEERUXZQ7Dc2xr2reZ64
EOF
```

---

### Task 7: Live verification of admin RLS on cities/shops/lists/list_items

Migration `0018_admin_foundation.sql` (already merged) added `is_admin()`-gated insert/update/delete policies on these four tables, but nothing has exercised them end-to-end with real writes yet — the original migration's own verification only checked `cities`. Verify the other three tables now that real code writes to them.

- [ ] **Step 1: Live-verify shops/lists/list_items write policies**

Using the Supabase MCP tools against project `kyiuhuivyugoqljqodil` (same project every prior migration in this branch's work has used, with standing authorization), combine `set_config` + action + assertion in one `execute_sql` call each:

- As the bootstrapped admin (`ethan2damax`), confirm an insert/update/delete on `shops`, `lists`, and `list_items` each succeed.
- As a non-admin, confirm the same operations on each of the three tables are rejected.

Clean up any test rows created. Report actual query output for each case, not a summary.

- [ ] **Step 2: No commit** — this step verifies existing, already-merged migration behavior; it doesn't change any file.

---

## Self-review notes

- **Spec coverage:** cities CRUD ✅, shops CRUD + curation (the actual "approve a shop" mechanism) ✅, flagged-shop review workflow ✅, city guides CRUD ✅, ordered shop membership (with the noted custom-order limitation) ✅. Moderation queue and partners table are explicitly out of scope per the user's stated ordering.
- **Placeholder scan:** Task 6's "Step 2 — stop and add a function" is a real, necessary mid-task correction discovered while writing the plan (not a TBD) — the function it specifies is fully written, not deferred.
- **Type consistency:** `AdminShopRow`/`ShopFields`/`CityGuideFields`/`AdminCityGuideRow` field names match between `queries.ts` and every page that consumes them throughout this document.
- **Ambiguity check:** the nested-select shape for `shop_curations` in `getAdminShops` (Supabase returns a single related row as an object for a to-one relationship, but the exact shape can vary by client version) is flagged with a defensive `Array.isArray` check in the implementation — the implementer should confirm which shape the live client actually returns and simplify once confirmed, rather than trusting this speculatively defensive code blindly.
