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

const DEFAULT_ZOOM = 13;
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
    ".leaflet-bottom{bottom:var(--snob-bottom-inset,0px)}",
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
        // The plugin ignores Leaflet's `attribution` option and shows the
        // style's own source credits unless `attributionControl.customAttribution`
        // is set, so that's where our short credit goes.
        layer = L.maplibreGL({ style, attributionControl: { customAttribution: BASEMAP.attribution } } as never).addTo(map);
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

// Leaflet measures its container once at mount and never re-checks on its
// own — if that container's real size changes afterward (the safe-area
// inset resolving a beat after first paint, the address bar collapsing,
// a phone rotating), the map's own rendered/tiled area stays locked to
// the old, usually-smaller size: a hard flat edge with dead space beyond
// it, not a gradual redraw. A ResizeObserver + invalidateSize() is the
// standard fix — it keeps the map's actual draw area in sync with
// whatever its container really is, whenever that changes.
function ResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function CameraController({ target, zoom }: { target: MapViewProps["cameraTarget"]; zoom: MapViewProps["zoomRequest"] }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom ?? Math.max(map.getZoom(), DEFAULT_ZOOM));
    // Only a new nonce should move the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.nonce]);
  useEffect(() => {
    if (!zoom) return;
    if (zoom.delta > 0) map.zoomIn();
    else map.zoomOut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom?.nonce]);
  return null;
}

export function MapView({
  ratedShops,
  nearbyShops,
  initialCenter,
  userLocation,
  cameraTarget,
  zoomRequest,
  onBoundsChange,
  selectedRatedShopId,
  selectedNearbyExternalId,
  onSelectRatedShop,
  onSelectNearbyShop,
  bottomInset,
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
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, isolation: "isolate", ["--snob-bottom-inset" as string]: `${bottomInset ?? 0}px` }}
      >
        <Basemap />
        <ResizeHandler />
        <ViewportEvents
          onBoundsChange={onBoundsChange}
          onClearSelection={() => {
            // Clearing either selection clears both (see map.tsx select handlers).
            onSelectRatedShop(null);
          }}
        />
        <CameraController target={cameraTarget} zoom={zoomRequest} />

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
