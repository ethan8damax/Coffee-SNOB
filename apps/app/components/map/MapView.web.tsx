// apps/app/components/map/MapView.web.tsx
import { useCallback, useRef } from "react";
// react-map-gl 8.1.3 has no root "." export (package.json `exports` only
// lists "./mapbox", "./maplibre", "./mapbox-legacy") — the plan's
// `from "react-map-gl"` import doesn't resolve. We're on Mapbox (native
// side uses @rnmapbox/maps), so import from the "/mapbox" subpath, which
// re-exports @vis.gl/react-mapbox. Map/Marker/MapRef props are otherwise
// unchanged: mapboxAccessToken, initialViewState, mapStyle, onMoveEnd,
// and MapRef.getBounds() all still match the plan's snippet.
import Map, { Marker, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { colors } from "@coffeesnob/design-tokens";
import { pinStyleForRating } from "./pin-style";
import type { MapViewProps } from "./types";

export function MapView({
  ratedShops,
  nearbyShops,
  onBoundsChange,
  selectedRatedShopId,
  selectedNearbyExternalId,
  onSelectRatedShop,
  onSelectNearbyShop,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null);

  const handleMoveEnd = useCallback(() => {
    const bounds = mapRef.current?.getBounds();
    if (!bounds) return;
    onBoundsChange({
      minLat: bounds.getSouth(),
      maxLat: bounds.getNorth(),
      minLng: bounds.getWest(),
      maxLng: bounds.getEast(),
    });
  }, [onBoundsChange]);

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? ""}
      initialViewState={{ longitude: -9.14, latitude: 38.71, zoom: 13 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/light-v11"
      onMoveEnd={handleMoveEnd}
    >
      {nearbyShops.map((shop) => {
        const selected = selectedNearbyExternalId === shop.externalId;
        return (
          <Marker key={shop.externalId} longitude={shop.lng} latitude={shop.lat} onClick={() => onSelectNearbyShop(shop.externalId)}>
            <div
              style={{
                width: selected ? 11 : 7,
                height: selected ? 11 : 7,
                borderRadius: "50%",
                background: selected ? colors.ink : colors.card,
                border: `1.4px solid ${selected ? colors.ink : colors.ink3}`,
                cursor: "pointer",
              }}
            />
          </Marker>
        );
      })}

      {ratedShops.map((shop) => {
        const style = pinStyleForRating(shop.rating);
        const selected = selectedRatedShopId === shop.id;
        return (
          <Marker key={shop.id} longitude={shop.lng} latitude={shop.lat} onClick={() => onSelectRatedShop(shop.id)}>
            <div
              style={{
                padding: "5px 7px",
                borderRadius: 2,
                background: style.background,
                border: `${selected ? 2 : 1}px solid ${selected ? colors.ink : style.border}`,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ color: style.foreground, fontSize: 11, fontWeight: 700 }}>{shop.rating}</span>
            </div>
          </Marker>
        );
      })}
    </Map>
  );
}
