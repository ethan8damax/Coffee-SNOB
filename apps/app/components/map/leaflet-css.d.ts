// leaflet ships its stylesheet without type declarations; tsc (TS2882) needs
// an ambient module to allow the side-effect import in MapView.web.tsx.
declare module "leaflet/dist/leaflet.css";
