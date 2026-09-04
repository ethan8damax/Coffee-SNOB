import { useCallback } from "react";
import { Text, View } from "react-native";
import Mapbox, { MapView as RNMapboxMapView, Camera, PointAnnotation } from "@rnmapbox/maps";
import type { MapState } from "@rnmapbox/maps";
import { colors } from "@coffeesnob/design-tokens";
import { pinStyleForRating } from "./pin-style";
import type { MapViewProps } from "./types";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "");

export function MapView({
  ratedShops,
  nearbyShops,
  onBoundsChange,
  selectedRatedShopId,
  selectedNearbyExternalId,
  onSelectRatedShop,
  onSelectNearbyShop,
}: MapViewProps) {
  // Plan used a mapRef + onRegionDidChange + getVisibleBounds(). In the
  // installed @rnmapbox/maps 10.3.5, onRegionDidChange is deprecated in
  // favor of onMapIdle (console.warn, "will be removed in next release"),
  // and onMapIdle's own payload already carries the settled bounds — so
  // no ref or extra native call is needed.
  const handleMapIdle = useCallback(
    (state: MapState) => {
      const { ne, sw } = state.properties.bounds;
      onBoundsChange({ minLat: sw[1], maxLat: ne[1], minLng: sw[0], maxLng: ne[0] });
    },
    [onBoundsChange],
  );

  return (
    <View style={{ flex: 1 }}>
      <RNMapboxMapView style={{ flex: 1 }} styleURL="mapbox://styles/mapbox/light-v11" onMapIdle={handleMapIdle}>
        <Camera defaultSettings={{ centerCoordinate: [-9.14, 38.71], zoomLevel: 13 }} />

        {nearbyShops.map((shop) => {
          const selected = selectedNearbyExternalId === shop.externalId;
          return (
            <PointAnnotation key={shop.externalId} id={shop.externalId} coordinate={[shop.lng, shop.lat]} onSelected={() => onSelectNearbyShop(shop.externalId)}>
              <View
                style={{
                  width: selected ? 11 : 7,
                  height: selected ? 11 : 7,
                  borderRadius: 999,
                  backgroundColor: selected ? colors.ink : colors.card,
                  borderWidth: 1.4,
                  borderColor: selected ? colors.ink : colors.ink3,
                }}
              />
            </PointAnnotation>
          );
        })}

        {ratedShops.map((shop) => {
          const style = pinStyleForRating(shop.rating);
          const selected = selectedRatedShopId === shop.id;
          return (
            <PointAnnotation key={shop.id} id={shop.id} coordinate={[shop.lng, shop.lat]} onSelected={() => onSelectRatedShop(shop.id)}>
              <View
                style={{
                  paddingVertical: 5,
                  paddingHorizontal: 7,
                  borderRadius: 2,
                  backgroundColor: style.background,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? colors.ink : style.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: style.foreground, fontSize: 11, fontWeight: "700" }}>{String(shop.rating)}</Text>
              </View>
            </PointAnnotation>
          );
        })}
      </RNMapboxMapView>
    </View>
  );
}
