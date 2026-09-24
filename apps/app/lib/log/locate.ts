export type ShopLocation = { locality?: string | null; region?: string | null; countryCode?: string | null };

const TIMEOUT_MS = 2500;

// Which city a newly logged shop is in (web /api/locate), so it lands on its
// city page. Best effort: a failure or slow answer logs the visit without it
// rather than holding up Publish.
export async function locateShop(lat: number, lng: number, webAppUrl: string): Promise<ShopLocation> {
  const params = new URLSearchParams({ lat: lat.toFixed(3), lng: lng.toFixed(3) });
  const lookup = fetch(`${webAppUrl}/api/locate?${params}`)
    .then((r) => (r.ok ? (r.json() as Promise<ShopLocation>) : {}))
    .catch(() => ({}));
  const timeout = new Promise<ShopLocation>((resolve) => setTimeout(() => resolve({}), TIMEOUT_MS));
  return Promise.race([lookup, timeout]);
}
