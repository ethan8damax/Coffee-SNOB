// mapbox-gl ships no type declarations for its CSS side-effect import;
// tsc (TS2882) needs an ambient module to allow it in MapView.web.tsx.
declare module "mapbox-gl/dist/mapbox-gl.css";
