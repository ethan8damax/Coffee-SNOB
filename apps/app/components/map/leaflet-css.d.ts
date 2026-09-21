// leaflet and maplibre-gl ship their stylesheets without type declarations;
// tsc (TS2882) needs ambient modules to allow the side-effect imports in
// MapView.web.tsx.
declare module "leaflet/dist/leaflet.css";
declare module "maplibre-gl/dist/maplibre-gl.css";
