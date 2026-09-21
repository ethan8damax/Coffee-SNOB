import { useEffect, useMemo } from "react";
import { View } from "react-native";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BASEMAP } from "./basemap";
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
    `.snob-tiles{filter:${BASEMAP.tintFilter}}`,
    ".snob-pin{background:none;border:none}",
    ".leaflet-container{background:#e6dec9;font-family:'Area',sans-serif}",
    ".leaflet-control-attribution{font-size:9px;background:rgba(240,236,223,.85)!important}",
  ].join("");
  document.head.appendChild(el);
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
        <TileLayer url={BASEMAP.url} subdomains={BASEMAP.subdomains} maxZoom={BASEMAP.maxZoom} attribution={BASEMAP.attribution} className="snob-tiles" />
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
