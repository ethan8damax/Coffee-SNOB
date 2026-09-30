import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { loadBaseStyle } from "../map/load-style";
import { streetsStyle } from "../map/streets-style";
import { Tag } from "./tag";

// The shop band when a shop has no photo: its streets, faint on oxblood, drawn
// from the tiles the map already uses. Not interactive; no labels, no pin. If
// the style can't load, the band just stays oxblood.
export function StreetBand({ lat, lng }: { lat: number; lng: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let map: maplibregl.Map | null = null;
    loadBaseStyle()
      .then((style) => {
        if (cancelled || !ref.current) return;
        map = new maplibregl.Map({
          container: ref.current,
          style: streetsStyle(style) as never,
          center: [lng, lat],
          zoom: 15.5,
          interactive: false,
          attributionControl: false,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng]);
  return (
    <>
      <div ref={ref} aria-hidden style={{ position: "absolute", inset: 0 }} />
      <Tag label="© OpenStreetMap" style={{ position: "absolute", top: 12, right: 16 }} />
    </>
  );
}
