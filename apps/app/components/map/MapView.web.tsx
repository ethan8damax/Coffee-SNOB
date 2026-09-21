import { useEffect, useMemo } from "react";
import { View } from "react-native";
import L from "leaflet";
import { MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";
import "@maplibre/maplibre-gl-leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { BASEMAP } from "./basemap";
import { brandStyle, type StyleLike } from "./brand-style";
import { nearbyDotHtml, ratedPinHtml, userDotHtml } from "./pin-markup";
import type { MapBounds, MapViewProps } from "./types";

const DEFAULT_ZOOM = 14;
// ponytail: cap the unrated dots so a dense downtown doesn't put thousands of
// DOM markers on the page. Ceiling: past this, far-from-center cafés drop off.
// Upgrade path: marker clustering (leaflet.markercluster) or a canvas layer.
const MAX_DOTS = 400;

const STYLE_ID = "snob-map-styles";
function ensureMapStyles() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = [
    ".snob-pin{background:none;border:none}",
    ".leaflet-container{background:#e6dec9;font-family:'Area',sans-serif}",
    ".leaflet-control-attribution{font-size:9px;background:rgba(240,236,223,.85)!important}",
  ].join("");
  document.head.appendChild(el);
}

// One fetch of the style per page load, recolored to the design palette.
let styleRequest: Promise<StyleLike> | null = null;
function loadBrandStyle(): Promise<StyleLike> {
  styleRequest ??= fetch(BASEMAP.styleUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`basemap style request failed: ${response.status}`);
      return response.json() as Promise<StyleLike>;
    })
    .then(brandStyle)
    .catch((error) => {
      styleRequest = null;
      throw error;
    });
  return styleRequest;
}

// Vector basemap drawn by MapLibre inside a Leaflet layer. If the style can't
// load, the container's land-colored background stays and pins still work.
function Basemap() {
  const map = useMap();
  useEffect(() => {
    let cancelled = false;
    let layer: L.MaplibreGL | null = null;
    loadBrandStyle()
      .then((style) => {
        if (cancelled) return;
        // `attribution` is a standard Leaflet layer option that the plugin's
        // typings don't list; it is read by Leaflet's attribution control.
        layer = L.maplibreGL({ style, attribution: BASEMAP.attribution } as never).addTo(map);
        layer.getMaplibreMap().on("error", (event) => console.warn("basemap:", event.error?.message ?? event));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      layer?.remove();
    };
  }, [map]);
  return null;
}

function pinIcon(html: string) {
  return L.divIcon({ html, className: "snob-pin", iconSize: [0, 0], iconAnchor: [0, 0] });
}

function ViewportEvents({ onBoundsChange, onClearSelection }: { onBoundsChange: (b: MapBounds) => void; onClearSelection: () => void }) {
  const map = useMapEvents({
    moveend: () => {
      const b = map.getBounds();
      onBoundsChange({ minLat: b.getSouth(), maxLat: b.getNorth(), minLng: b.getWest(), maxLng: b.getEast() });
    },
    click: onClearSelection,
  });
  return null;
}

function Recenter({ target, recenterKey }: { target: { lat: number; lng: number } | null; recenterKey: number }) {
  const map = useMap();
  useEffect(() => {
    if (recenterKey > 0 && target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), DEFAULT_ZOOM));
    // Only a new recenterKey should trigger a fly — not a fresh location fix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);
  return null;
}

export function MapView({
  ratedShops,
  nearbyShops,
  initialCenter,
  userLocation,
  recenterKey,
  onBoundsChange,
  selectedRatedShopId,
  selectedNearbyExternalId,
  onSelectRatedShop,
  onSelectNearbyShop,
}: MapViewProps) {
  ensureMapStyles();

  const anySelected = selectedRatedShopId !== null || selectedNearbyExternalId !== null;
  const userIcon = useMemo(() => pinIcon(userDotHtml()), []);
  const dots = useMemo(() => nearbyShops.slice(0, MAX_DOTS), [nearbyShops]);

  return (
    <View style={{ flex: 1 }}>
      <MapContainer
        center={[initialCenter.lat, initialCenter.lng]}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        // isolation keeps Leaflet's internal z-indexes from covering the app's own overlays.
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, isolation: "isolate" }}
      >
        <Basemap />
        <ViewportEvents
          onBoundsChange={onBoundsChange}
          onClearSelection={() => {
            // Clearing either selection clears both (see map.tsx select handlers).
            onSelectRatedShop(null);
          }}
        />
        <Recenter target={userLocation} recenterKey={recenterKey} />

        {dots.map((shop) => {
          const selected = selectedNearbyExternalId === shop.externalId;
          return (
            <Marker
              key={shop.externalId}
              position={[shop.lat, shop.lng]}
              icon={pinIcon(nearbyDotHtml({ selected }))}
              title={shop.name}
              zIndexOffset={selected ? 500 : 0}
              eventHandlers={{ click: () => onSelectNearbyShop(shop.externalId) }}
            />
          );
        })}

        {ratedShops.map((shop) => {
          const selected = selectedRatedShopId === shop.id;
          return (
            <Marker
              key={shop.id}
              position={[shop.lat, shop.lng]}
              icon={pinIcon(ratedPinHtml({ name: shop.name, rating: shop.rating, selected, dimmed: anySelected && !selected }))}
              title={shop.name}
              zIndexOffset={selected ? 2000 : 1000}
              eventHandlers={{ click: () => onSelectRatedShop(shop.id) }}
            />
          );
        })}

        {userLocation && <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} interactive={false} keyboard={false} zIndexOffset={3000} />}
      </MapContainer>
    </View>
  );
}
