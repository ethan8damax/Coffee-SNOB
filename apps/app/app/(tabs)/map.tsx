import { useEffect, useMemo, useRef, useState } from "react";
import { View, ActivityIndicator, StyleSheet, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { MapView } from "../../components/map/MapView";
import { FilterChips, LocateButton, MapTopBar, ViewToggle, ZoomControls } from "../../components/map/map-controls";
import { PreviewCard } from "../../components/map/preview-card";
import { ShopListView } from "../../components/map/shop-list-view";
import { rowKey } from "../../components/map/shop-row";
import { D4, Label } from "../../components/primitives";
import type { MapBounds, MapViewProps } from "../../components/map/types";
import { useNearbyMapData } from "../../lib/map/nearby-map-data";
import { useOnline } from "../../lib/map/use-online";
import { useUserLocation } from "../../lib/map/use-user-location";
import { boundsAround } from "../../lib/map/bounds";
import { applyFilter, buildRows, type ListRow, type MapFilter } from "../../lib/map/shop-list";
import { openDirections } from "../../lib/directions";
import { isDesktopWidth } from "@/lib/nav";

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? "";

// Where the map opens when the visitor's real location isn't available.
const FALLBACK = { name: "Atlanta", lat: 33.749, lng: -84.388 };
const PANEL_WIDTH = 380;
const TAB_BAR_HEIGHT = 78;

type CameraTarget = NonNullable<MapViewProps["cameraTarget"]>;
type ZoomRequest = NonNullable<MapViewProps["zoomRequest"]>;

function boundsCenter(b: MapBounds) {
  return { lat: (b.minLat + b.maxLat) / 2, lng: (b.minLng + b.maxLng) / 2 };
}

export default function MapScreen() {
  const { width, height } = useWindowDimensions();
  const desktop = isDesktopWidth(width);
  const { center: userCenter, loading: locationLoading } = useUserLocation();
  const online = useOnline();
  const center = userCenter ?? FALLBACK;

  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [filter, setFilter] = useState<MapFilter>("all");
  const [mode, setMode] = useState<"Map" | "List">("Map");
  const [selectedRatedShopId, setSelectedRatedShopId] = useState<string | null>(null);
  const [selectedNearbyExternalId, setSelectedNearbyExternalId] = useState<string | null>(null);
  const [camera, setCamera] = useState<CameraTarget | null>(null);
  const [zoomRequest, setZoomRequest] = useState<ZoomRequest | null>(null);
  const nonce = useRef(0);

  const flyTo = (lat: number, lng: number, zoom?: number) => setCamera({ lat, lng, zoom, nonce: ++nonce.current });

  // Seed bounds once location settles, so the first data fetch fires
  // immediately instead of waiting for the first pan. Runs once: the `!bounds`
  // check stops it from re-seeding after a real pan has set bounds.
  useEffect(() => {
    if (!locationLoading && !bounds) setBounds(boundsAround(center, 0.03));
  }, [locationLoading, bounds, center]);

  // If the map opened on the fallback (no fix in time) and the device's
  // location then arrives, move there once.
  const openedOnFallback = useRef(false);
  useEffect(() => {
    if (!locationLoading && !userCenter) openedOnFallback.current = true;
  }, [locationLoading, userCenter]);
  useEffect(() => {
    if (userCenter && openedOnFallback.current) {
      openedOnFallback.current = false;
      flyTo(userCenter.lat, userCenter.lng);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCenter]);

  const { ratedShops, nearbyShops, status, reload } = useNearbyMapData(bounds, WEB_APP_URL);
  const visible = useMemo(() => applyFilter(filter, ratedShops, nearbyShops), [filter, ratedShops, nearbyShops]);
  const origin = userCenter ?? (bounds ? boundsCenter(bounds) : null);
  const rows = useMemo(() => buildRows(visible.rated, visible.nearby, origin), [visible, origin]);

  const activeKey = selectedRatedShopId ? `r:${selectedRatedShopId}` : selectedNearbyExternalId ? `n:${selectedNearbyExternalId}` : null;
  const selectedRow = activeKey ? (rows.find((r) => rowKey(r) === activeKey) ?? null) : null;

  const selectRated = (id: string | null) => {
    setSelectedRatedShopId(id);
    setSelectedNearbyExternalId(null);
  };
  const selectNearby = (externalId: string | null) => {
    setSelectedNearbyExternalId(externalId);
    setSelectedRatedShopId(null);
  };

  const openShop = (row: ListRow) => {
    if (row.kind === "rated") router.push(`/shop/${row.shop.id}`);
  };

  const logVisit = (row: ListRow) => {
    if (row.kind === "rated") {
      router.push({ pathname: "/log", params: { shopId: row.shop.id } });
      return;
    }
    const { externalId, name, lat, lng, address, website, phone, hours } = row.shop;
    const params: Record<string, string> = { externalId, name, lat: String(lat), lng: String(lng) };
    if (address) params.address = address;
    if (website) params.website = website;
    if (phone) params.phone = phone;
    if (hours) params.hours = hours;
    router.push({ pathname: "/log", params });
  };

  const onPressRow = (row: ListRow) => {
    if (row.kind === "rated") {
      if (!desktop) {
        openShop(row);
        return;
      }
      selectRated(row.shop.id);
    } else {
      selectNearby(row.shop.externalId);
    }
    setMode("Map");
    flyTo(row.shop.lat, row.shop.lng, 16);
  };

  const locate = () => userCenter && flyTo(userCenter.lat, userCenter.lng);
  const zoom = (delta: 1 | -1) => setZoomRequest({ delta, nonce: ++nonce.current });

  if (locationLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper }}>
        <ActivityIndicator color={colors.oxblood} />
      </View>
    );
  }

  const map = (
    <MapView
      ratedShops={visible.rated}
      nearbyShops={visible.nearby}
      initialCenter={center}
      userLocation={userCenter}
      cameraTarget={camera}
      zoomRequest={zoomRequest}
      onBoundsChange={setBounds}
      selectedRatedShopId={selectedRatedShopId}
      selectedNearbyExternalId={selectedNearbyExternalId}
      onSelectRatedShop={selectRated}
      onSelectNearbyShop={selectNearby}
    />
  );

  const preview = selectedRow ? (
    <PreviewCard
      row={selectedRow}
      onOpen={() => openShop(selectedRow)}
      onLog={() => logVisit(selectedRow)}
      onDirections={() => openDirections(selectedRow.shop.lat, selectedRow.shop.lng)}
      onDismiss={() => selectRated(null)}
    />
  ) : null;

  const list = (wide: boolean) => (
    <ShopListView
      rows={rows}
      activeKey={activeKey}
      wide={wide}
      status={status}
      offline={!online}
      fallbackLabel={userCenter ? null : FALLBACK.name}
      onPressRow={onPressRow}
      onRetry={reload}
    />
  );

  const countLabel = `${rows.length} ${rows.length === 1 ? "shop" : "shops"} nearby`;

  if (desktop) {
    return (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.paper }}>
        <View style={{ width: PANEL_WIDTH, borderRightWidth: 1, borderRightColor: colors.rule, backgroundColor: colors.paper }}>
          <View style={{ paddingTop: 16, paddingBottom: 12, gap: 13, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
            <D4 accessibilityRole="header" style={{ paddingHorizontal: 20, fontSize: 22, lineHeight: 22, letterSpacing: -0.62 }}>
              {countLabel}
            </D4>
            <FilterChips value={filter} onChange={setFilter} />
          </View>
          <View style={{ flex: 1 }}>{list(true)}</View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {map}
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <View style={{ position: "absolute", top: 16, right: 16 }}>
              <ZoomControls onZoom={zoom} onLocate={locate} locateDisabled={!userCenter} />
            </View>
            {preview ? <View style={{ position: "absolute", left: 16, bottom: 16, width: 360, maxWidth: "90%" }}>{preview}</View> : null}
          </View>
        </View>
      </View>
    );
  }

  const areaHeight = height - TAB_BAR_HEIGHT;
  const sheetHeight = mode === "List" ? Math.round(areaHeight * 0.62) : Math.min(316, Math.round(areaHeight * 0.42));

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      {map}
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: "space-between" }]}>
        <View pointerEvents="box-none">
          <MapTopBar areaLabel={userCenter ? "Near you" : FALLBACK.name} count={rows.length} onLocate={locate} locateDisabled={!userCenter} />
          <FilterChips value={filter} onChange={setFilter} />
        </View>
        <View pointerEvents="box-none">
          {preview && mode === "Map" ? <View style={{ marginHorizontal: 16, marginBottom: 12 }}>{preview}</View> : null}
          <View style={{ height: sheetHeight, backgroundColor: colors.paper, borderTopWidth: 2, borderTopColor: colors.ink }}>
            <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 }}>
              <View style={{ width: 34, height: 2, backgroundColor: colors.rule, alignSelf: "center", marginBottom: 10 }} />
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Label style={{ color: colors.ink }}>{countLabel}</Label>
                <ViewToggle value={mode} onChange={setMode} />
              </View>
            </View>
            <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: colors.rule }}>{list(false)}</View>
          </View>
        </View>
      </View>
    </View>
  );
}
