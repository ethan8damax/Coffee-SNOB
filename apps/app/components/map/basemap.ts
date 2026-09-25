// The ONE place the map's tiles are defined. Swapping providers means editing
// this file (and, if the new provider isn't OpenMapTiles-schema, brand-style.ts).
//
// OpenFreeMap: free vector tiles, no API key, no usage limits, commercial use
// allowed (https://openfreemap.org). Rendered inside Leaflet through
// @maplibre/maplibre-gl-leaflet and recolored to the design palette by
// brandStyle(). Attribution is required — keep it visible.
//
// ponytail: depends on one free public instance. Ceiling: no SLA. Upgrade
// path: self-host the OpenFreeMap tiles (weekly planet files are published) or
// point styleUrl at any other OpenMapTiles-schema style.
export const BASEMAP = {
  styleUrl: "https://tiles.openfreemap.org/styles/positron",
  // Short on purpose: ODbL and OpenMapTiles need a visible credit on the map;
  // the full list lives on the site's Data sources page.
  attribution:
    '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">&copy; OpenStreetMap</a> · ' +
    '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · ' +
    '<a href="https://coffeesnobproject.com/data-sources" target="_blank" rel="noopener">Sources</a>',
} as const;
