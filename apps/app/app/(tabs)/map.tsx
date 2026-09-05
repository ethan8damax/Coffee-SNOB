import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { MapView } from "../../components/map/MapView";
import { useNearbyMapData } from "../../lib/map/nearby-map-data";
import { useUserLocation } from "../../lib/map/use-user-location";
import { boundsAround } from "../../lib/map/bounds";
import { openDirections } from "../../lib/directions";
import type { MapBounds } from "../../components/map/types";

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? "";

// Used only when the visitor's real location can't be resolved (denied,
// unavailable, or timed out) — see useUserLocation.
const LISBON_FALLBACK = { lat: 38.71, lng: -9.14 };

export default function MapScreen() {
  const { center: userCenter, loading: locationLoading } = useUserLocation();
  const center = userCenter ?? LISBON_FALLBACK;
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [selectedRatedShopId, setSelectedRatedShopId] = useState<string | null>(null);
  const [selectedNearbyExternalId, setSelectedNearbyExternalId] = useState<string | null>(null);

  // Seed bounds once location settles, so the first data fetch fires
  // immediately instead of waiting for onBoundsChange (onMoveEnd/onMapIdle
  // don't fire for the initial camera settle — see map-screen bugfix
  // notes). Runs once: the `!bounds` check stops it from re-seeding after
  // a real pan has already set bounds to something else.
  useEffect(() => {
    if (!locationLoading && !bounds) setBounds(boundsAround(center, 0.03));
  }, [locationLoading, bounds, center]);

  const { ratedShops, nearbyShops } = useNearbyMapData(bounds, WEB_APP_URL);

  const selectedRatedShop = ratedShops.find((s) => s.id === selectedRatedShopId) ?? null;
  const selectedNearbyShop = nearbyShops.find((s) => s.externalId === selectedNearbyExternalId) ?? null;

  const selectRated = (id: string | null) => {
    setSelectedRatedShopId(id);
    setSelectedNearbyExternalId(null);
  };
  const selectNearby = (externalId: string | null) => {
    setSelectedNearbyExternalId(externalId);
    setSelectedRatedShopId(null);
  };

  const logRatedVisit = () => {
    if (!selectedRatedShop) return;
    router.push({ pathname: "/(tabs)/log", params: { shopId: selectedRatedShop.id, name: selectedRatedShop.name } });
  };
  const logNearbyVisit = () => {
    if (!selectedNearbyShop) return;
    router.push({
      pathname: "/(tabs)/log",
      params: {
        externalId: selectedNearbyShop.externalId,
        name: selectedNearbyShop.name,
        lat: String(selectedNearbyShop.lat),
        lng: String(selectedNearbyShop.lng),
      },
    });
  };

  if (locationLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper }}>
        <ActivityIndicator color={colors.oxblood} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ratedShops={ratedShops}
        nearbyShops={nearbyShops}
        initialCenter={center}
        onBoundsChange={setBounds}
        selectedRatedShopId={selectedRatedShopId}
        selectedNearbyExternalId={selectedNearbyExternalId}
        onSelectRatedShop={selectRated}
        onSelectNearbyShop={selectNearby}
      />

      {selectedRatedShop && (
        <View style={{ position: "absolute", left: 16, right: 16, bottom: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, borderRadius: 2, padding: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Text style={{ fontWeight: "700", color: colors.ink }}>{selectedRatedShop.name}</Text>
            <Pressable
              onPress={() => selectRated(null)}
              hitSlop={10}
              style={{ padding: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
            >
              <Text style={{ color: colors.ink2, fontWeight: "700" }}>×</Text>
            </Pressable>
          </View>
          <Text style={{ color: colors.ink2, marginTop: 4 }}>{selectedRatedShop.neighborhood} · {selectedRatedShop.tag}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <Pressable
              onPress={logRatedVisit}
              style={{ flex: 1, backgroundColor: colors.oxblood, padding: 10, borderRadius: 2, alignItems: "center" }}
              accessibilityRole="button"
              accessibilityLabel={`Log a visit to ${selectedRatedShop.name}`}
            >
              <Text style={{ color: colors.cream, fontWeight: "700" }}>Log a visit</Text>
            </Pressable>
            <Pressable
              onPress={() => openDirections(selectedRatedShop.lat, selectedRatedShop.lng)}
              style={{ padding: 10, borderWidth: 1, borderColor: colors.ink3, borderRadius: 2 }}
              accessibilityRole="button"
              accessibilityLabel={`Directions to ${selectedRatedShop.name}`}
            >
              <Text style={{ color: colors.ink }}>Directions</Text>
            </Pressable>
          </View>
        </View>
      )}

      {selectedNearbyShop && (
        <View style={{ position: "absolute", left: 16, right: 16, bottom: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.rule, borderRadius: 2, padding: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Text style={{ fontWeight: "700", color: colors.ink }}>{selectedNearbyShop.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: colors.ink2 }}>Not yet rated</Text>
              <Pressable
                onPress={() => selectNearby(null)}
                hitSlop={10}
                style={{ padding: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
              >
                <Text style={{ color: colors.ink2, fontWeight: "700" }}>×</Text>
              </Pressable>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <Pressable
              onPress={logNearbyVisit}
              style={{ flex: 1, backgroundColor: colors.oxblood, padding: 10, borderRadius: 2, alignItems: "center" }}
              accessibilityRole="button"
              accessibilityLabel={`Log a visit to ${selectedNearbyShop.name}`}
            >
              <Text style={{ color: colors.cream, fontWeight: "700" }}>Log a visit</Text>
            </Pressable>
            <Pressable
              onPress={() => openDirections(selectedNearbyShop.lat, selectedNearbyShop.lng)}
              style={{ padding: 10, borderWidth: 1, borderColor: colors.ink3, borderRadius: 2 }}
              accessibilityRole="button"
              accessibilityLabel={`Directions to ${selectedNearbyShop.name}`}
            >
              <Text style={{ color: colors.ink }}>Directions</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
