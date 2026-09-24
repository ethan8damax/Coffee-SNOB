// A city's page key, e.g. "atlanta-georgia-us". Same rule as the generated
// column shops.city_key (supabase/migrations/0026_shop_city.sql) — keep in
// step, or a search result links to a page its shops never land on.
export function cityKey(locality: string | null | undefined, region: string | null | undefined, countryCode: string | null | undefined): string | null {
  if (!locality?.trim()) return null;
  return `${locality}-${region ?? ""}-${countryCode ?? ""}`
    .replace(/[^A-Za-z0-9]+/g, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, "");
}
