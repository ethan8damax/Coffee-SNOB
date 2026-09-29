export type ShopLocation = { locality?: string | null; region?: string | null; countryCode?: string | null; address?: string | null };

const TIMEOUT_MS = 2500;

// Which city a newly logged shop is in (web /api/locate), so it lands on its
// city page. Best effort: a failure or slow answer logs the visit without it
// rather than holding up Publish.
// precise (Add a shop): the exact spot, plus its street address.
export async function locateShop(lat: number, lng: number, webAppUrl: string, precise = false): Promise<ShopLocation> {
  const digits = precise ? 5 : 3;
  const params = new URLSearchParams({ lat: lat.toFixed(digits), lng: lng.toFixed(digits), ...(precise ? { precise: "1" } : {}) });
  const lookup = fetch(`${webAppUrl}/api/locate?${params}`)
    .then((r) => (r.ok ? (r.json() as Promise<ShopLocation>) : {}))
    .catch(() => ({}));
  const timeout = new Promise<ShopLocation>((resolve) => setTimeout(() => resolve({}), TIMEOUT_MS));
  return Promise.race([lookup, timeout]);
}
