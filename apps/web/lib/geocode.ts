// Address formatting for search results: the "City, ST, USA" line under a
// shop and the "ST, USA" line under a place. Used by lib/photon.ts (the map's
// search, /api/search). NominatimAddress is just the {city, state, country}
// shape these helpers read; Photon results are mapped into it.

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

// City, state (if there is one) and country, comma-joined —
// this is the shop search row's trailing line; the shop's own name is the bold headline,
// supplied by the caller, not by this address.
export function formatShopLocation(a: NominatimAddress | undefined): string {
  if (!a) return "";
  const countryAbbr = a.country_code ? abbreviateCountry(a.country_code) : null;
  const stateAbbr = a.state ? abbreviateState(a.state, a.country_code) : null;
  return [pickCity(a), stateAbbr, countryAbbr].filter(Boolean).join(", ");
}
