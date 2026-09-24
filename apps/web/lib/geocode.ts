// Place search ("city search") for the map's search bar — Nominatim, the reference
// OpenStreetMap geocoder: free, open-source, no API key, no per-account limits.
// Same fair-use shape as the Overpass proxy this app already runs (nearby-shops.ts):
// a custom User-Agent, and results cached rather than re-fetched. Pure, testable
// pieces here; the fetch + cache live in app/api/geocode/route.ts and
// app/api/reverse-geocode/route.ts.

export type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  state?: string;
  country?: string;
  country_code?: string;
};

export type NominatimResult = {
  place_id: number;
  lat: string;
  lon: string;
  address?: NominatimAddress;
};

// What the search bar shows: a bold headline (primary) and a smaller trailing line
// (secondary) — "City, ST, USA", "State, USA", or just "Country" for a country-level match.
export type Place = { id: string; primary: string; secondary: string; lat: number; lng: number };

// US state/territory name -> two-letter postal abbreviation. This app is US-first;
// other countries' states show in full rather than guessing at an abbreviation.
const US_STATE_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO",
  Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY",
  Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN",
  Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH",
  "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
  Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
  "Puerto Rico": "PR",
};

export function abbreviateState(state: string, countryCode: string | null | undefined): string {
  if ((countryCode ?? "").toLowerCase() !== "us") return state;
  return US_STATE_ABBR[state] ?? state;
}

// "USA", not the ISO "US" — everywhere else, the ISO 2-letter code (uppercased) is fine.
export function abbreviateCountry(countryCode: string): string {
  const upper = countryCode.toUpperCase();
  return upper === "US" ? "USA" : upper;
}

function pickCity(a: NominatimAddress): string | null {
  return a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? null;
}

// City, state (if there is one) and country from a reverse-geocode lookup, comma-joined —
// this is the shop search row's trailing line; the shop's own name is the bold headline,
// supplied by the caller, not by this address.
export function formatShopLocation(a: NominatimAddress | undefined): string {
  if (!a) return "";
  const countryAbbr = a.country_code ? abbreviateCountry(a.country_code) : null;
  const stateAbbr = a.state ? abbreviateState(a.state, a.country_code) : null;
  return [pickCity(a), stateAbbr, countryAbbr].filter(Boolean).join(", ");
}

// A forward search result's headline + trailing line, picked by the finest admin level
// Nominatim actually returned: a city match headlines the city ("Kennesaw" / "GA, USA"), a
// state match headlines the state ("Georgia" / "USA"), a country match is just the country.
export function formatAddress(a: NominatimAddress | undefined): { primary: string; secondary: string } | null {
  if (!a) return null;
  const countryAbbr = a.country_code ? abbreviateCountry(a.country_code) : null;
  const city = pickCity(a);
  if (city) {
    const stateAbbr = a.state ? abbreviateState(a.state, a.country_code) : null;
    return { primary: city, secondary: [stateAbbr, countryAbbr].filter(Boolean).join(", ") };
  }
  if (a.state) return { primary: a.state, secondary: countryAbbr ?? "" };
  if (a.country) return { primary: a.country, secondary: "" };
  return null;
}

export function toPlace(r: NominatimResult): Place | null {
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const formatted = formatAddress(r.address);
  if (!formatted) return null;
  return { id: String(r.place_id), primary: formatted.primary, secondary: formatted.secondary, lat, lng };
}
