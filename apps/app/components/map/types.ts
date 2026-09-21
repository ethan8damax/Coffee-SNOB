export type MapBounds = { minLat: number; minLng: number; maxLat: number; maxLng: number };

// A shop worth a tiered pin — either Snob-Approved or past the community
// log threshold. See docs/superpowers/specs/2026-09-03-map-community-
// shops-design.md, "Map rendering / integration".
export type RatedShopPin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  neighborhood: string | null;
  isSnobApproved: boolean;
  tag: string | null;
  priceTier: string | null;
  rating: number;
  logCount: number;
};

// A live OpenStreetMap result — unrated, no shops row exists for it yet.
export type NearbyShopPin = {
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  hours: string | null;
  website: string | null;
  phone: string | null;
};

export type MapViewProps = {
  ratedShops: RatedShopPin[];
  nearbyShops: NearbyShopPin[];
  initialCenter: { lat: number; lng: number };
  // The device's real location (null when denied/unavailable) — drawn as the
  // "you are here" dot, and the target of a recenter.
  userLocation: { lat: number; lng: number } | null;
  // Fly the map somewhere (locate-me, tapping a list row). `nonce` must change
  // for every request so repeating the same target still moves the map.
  cameraTarget: { lat: number; lng: number; zoom?: number; nonce: number } | null;
  // Zoom controls (desktop). Same nonce rule.
  zoomRequest: { delta: 1 | -1; nonce: number } | null;
  onBoundsChange: (bounds: MapBounds) => void;
  selectedRatedShopId: string | null;
  selectedNearbyExternalId: string | null;
  onSelectRatedShop: (id: string | null) => void;
  onSelectNearbyShop: (externalId: string | null) => void;
};
