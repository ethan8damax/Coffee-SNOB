// The ONE place the map's tiles are defined. Swapping providers (or moving to
// a self-hosted Protomaps style later) means editing this file only.
//
// ponytail: free raster tiles + a CSS tint toward the design's warm paper
// palette (land #e6dec9, roads cream — see the design's "Map style handoff").
// Ceiling: roads/labels are only approximately the design's palette, and
// provider free tiers have usage terms. Upgrade path: a custom vector style
// (Protomaps) rendered in Leaflet. LAUNCH CHECK: confirm CARTO's terms allow
// our commercial use, and keep this attribution visible.
export const BASEMAP = {
  url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  subdomains: "abcd",
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  // Applied to the tile layer only, so pins and chrome keep exact brand colors.
  tintFilter: "sepia(.45) saturate(.9) hue-rotate(-6deg) brightness(.99) contrast(.96)",
} as const;
