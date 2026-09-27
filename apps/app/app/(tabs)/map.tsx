import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/build/react-navigation/bottom-tabs";
import { colors } from "@coffeesnob/design-tokens";
import { MapView } from "../../components/map/MapView";
import { FilterChips, MapTopBar, ViewToggle, ZoomControls } from "../../components/map/map-controls";
import { ChevronIcon } from "../../components/map/map-icons";
import { MapSearch } from "../../components/map/map-search";
import { PreviewCard } from "../../components/map/preview-card";
import { AddShopBar, Crosshair } from "../../components/map/add-shop";
import { newShopId } from "../../lib/log/new-shop";
import { ShopListView } from "../../components/map/shop-list-view";
import { SearchResults } from "../../components/map/search-results";
import { Label } from "../../components/primitives";
import type { MapBounds, MapViewProps, NearbyShopPin, RatedShopPin } from "../../components/map/types";
import { useNearbyMapData } from "../../lib/map/nearby-map-data";
import { useOnline } from "../../lib/map/use-online";
import { useUserLocation } from "../../lib/map/use-user-location";
import { boundsAround } from "../../lib/map/bounds";
import { FALLBACK_CITY, readLastLocation, saveLastLocation } from "../../lib/map/fallback";
import type { Place } from "../../lib/map/geocode";
import { applyFilter, buildRows, withPinned, type ListRow, type MapFilter } from "../../lib/map/shop-list";
import { buildSearchSections, type ShopResult } from "../../lib/map/search-sort";
import { useMapSearch } from "../../lib/map/use-map-search";
import { openDirections } from "../../lib/directions";
import { isDesktopWidth } from "@/lib/nav";

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? "";

const PANEL_WIDTH = 380;

type CameraTarget = NonNullable<MapViewProps["cameraTarget"]>;
type ZoomRequest = NonNullable<MapViewProps["zoomRequest"]>;

function boundsCenter(b: MapBounds) {
  return { lat: (b.minLat + b.maxLat) / 2, lng: (b.minLng + b.maxLng) / 2 };
}

export default function MapScreen() {
  const { width, height } = useWindowDimensions();
  const desktop = isDesktopWidth(width);
  // Real, always-correct tab bar height (desktop hides the tab bar for the Rail
  // instead, but the hook must still be called unconditionally — Rules of Hooks —
  // its value is just unused on that branch). Was a hardcoded TAB_BAR_HEIGHT guess;
  // see sign-in-prompt.tsx for the same fix and why the guess approach is fragile.
  const tabBarHeight = useBottomTabBarHeight();
  const { center: userCenter, loading: locationLoading } = useUserLocation();
  const online = useOnline();
  // Open right away on the real fix, else where they last were, else the
  // fallback city — never a spinner while the location prompt is pending.
  const [startCenter] = useState(() => {
    const last = readLastLocation();
    return last ? { ...last, name: "where you last were" } : FALLBACK_CITY;
  });
  const center = userCenter ?? startCenter;

  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [filter, setFilter] = useState<MapFilter>("all");
  const [mode, setMode] = useState<"Map" | "List">("Map");
  const [listCollapsed, setListCollapsed] = useState(false);
  // null = automatic ("Near you" / the fallback city); set once someone searches a
  // place or a shop, cleared back to automatic by Locate.
  const [searchedAreaLabel, setSearchedAreaLabel] = useState<string | null>(null);
  // Typing in the search bar swaps the shop list for search results (2+ chars).
  const [query, setQuery] = useState("");
  const searching = query.trim().length >= 2;
  // The curated guide for the place last searched, if it has one — the list
  // header links to it once the map has flown there.
  const [guide, setGuide] = useState<{ slug: string; name: string } | null>(null);
  const [selectedRatedShopId, setSelectedRatedShopId] = useState<string | null>(null);
  const [selectedNearbyExternalId, setSelectedNearbyExternalId] = useState<string | null>(null);
  // A café picked from search shows (and stays selected) before its own area's
  // OSM data arrives; withPinned below drops it once the real entry shows up.
  const [pinnedShop, setPinnedShop] = useState<NearbyShopPin | null>(null);
  const [camera, setCamera] = useState<CameraTarget | null>(null);
  const [zoomRequest, setZoomRequest] = useState<ZoomRequest | null>(null);
  const nonce = useRef(0);
  // Pin mode for a café the map doesn't have: null = off, else the name so far.
  // The log screen's "Which shop?" opens it with ?add=1.
  const { add } = useLocalSearchParams<{ add?: string }>();
  const [adding, setAdding] = useState<string | null>(null);
  useEffect(() => {
    if (add) {
      setAdding("");
      router.setParams({ add: undefined });
    }
  }, [add]);

  const flyTo = (lat: number, lng: number, zoom?: number) => setCamera({ lat, lng, zoom, nonce: ++nonce.current });

  // Seed bounds immediately (on startCenter, before any fix arrives) so the
  // first data fetch fires without waiting for a pan. Runs once: the `!bounds`
  // check stops it from re-seeding after a real pan has set bounds.
  useEffect(() => {
    if (!bounds) setBounds(boundsAround(center, 0.04));
  }, [bounds, center]);

  // The map opened before the fix (last location or fallback); move once it
  // arrives — unless they've already searched somewhere (see search* below).
  const flewToFix = useRef(false);
  useEffect(() => {
    if (!userCenter) return;
    saveLastLocation(userCenter);
    if (flewToFix.current) return;
    flewToFix.current = true;
    flyTo(userCenter.lat, userCenter.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCenter]);

  const { ratedShops, nearbyShops, status, reload } = useNearbyMapData(bounds, WEB_APP_URL);
  const visible = useMemo(() => applyFilter(filter, ratedShops, withPinned(nearbyShops, pinnedShop, ratedShops)), [filter, ratedShops, nearbyShops, pinnedShop]);
  // The pin only exists to hold a fresh search pick; once the selection moves
  // off it (another pin, dismissed card), let it go so it can't follow you home.
  useEffect(() => {
    if (pinnedShop && selectedNearbyExternalId !== pinnedShop.externalId) setPinnedShop(null);
  }, [pinnedShop, selectedNearbyExternalId]);
  const origin = userCenter ?? (bounds ? boundsCenter(bounds) : null);
  const rows = useMemo(() => buildRows(visible.rated, visible.nearby, origin), [visible, origin]);
  // The list stops at MAX_ROWS; the count is everything the filter shows.
  const total = visible.rated.length + visible.nearby.length;
  // Search ranks near-first from what's actually on screen, not your real location —
  // if you've flown somewhere else to browse, that's "near" for search purposes.
  const searchOrigin = bounds ? boundsCenter(bounds) : userCenter;
  const search = useMapSearch(searching ? query : "", searchOrigin, WEB_APP_URL);
  const sections = useMemo(() => buildSearchSections(search.results ?? [], filter), [search.results, filter]);

  const activeKey = selectedRatedShopId ? `r:${selectedRatedShopId}` : selectedNearbyExternalId ? `n:${selectedNearbyExternalId}` : null;
  // Looked up in everything shown, not the capped list, so a far-away pick or a
  // shop past row 50 still gets its preview card.
  const selectedRow = useMemo(() => {
    const rated = selectedRatedShopId ? visible.rated.filter((s) => s.id === selectedRatedShopId) : [];
    const nearby = selectedNearbyExternalId ? visible.nearby.filter((s) => s.externalId === selectedNearbyExternalId) : [];
    return buildRows(rated, nearby, origin)[0] ?? null;
  }, [selectedRatedShopId, selectedNearbyExternalId, visible, origin]);

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
    // Index dots: their OSM ids, so a shop first rated under one isn't duplicated.
    // A hand-added shop the build linked to this dot rides along as "user/<uuid>".
    const legacy = (row.shop.sourceIds ?? []).flatMap((s) => (s.startsWith("osm:") ? [s.slice(4)] : s.startsWith("user/") ? [s] : []));
    if (legacy.length) params.legacyIds = legacy.join(",");
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

  const locate = () => {
    if (!userCenter) return;
    setSearchedAreaLabel(null);
    setGuide(null);
    setPinnedShop(null);
    flyTo(userCenter.lat, userCenter.lng);
  };
  const zoom = (delta: 1 | -1) => setZoomRequest({ delta, nonce: ++nonce.current });

  const searchPlace = (place: Place) => {
    flewToFix.current = true;
    setSearchedAreaLabel(place.primary);
    setGuide(place.guideSlug ? { slug: place.guideSlug, name: place.primary } : null);
    setQuery("");
    setMode("Map");
    setPinnedShop(null);
    selectRated(null);
    selectNearby(null);
    flyTo(place.lat, place.lng, 13);
  };
  const searchShop = (shop: RatedShopPin) => {
    flewToFix.current = true;
    setSearchedAreaLabel(shop.name);
    setMode("Map");
    setPinnedShop(null);
    selectRated(shop.id);
    flyTo(shop.lat, shop.lng, 16);
  };
  const searchNearbyShop = (shop: NearbyShopPin) => {
    flewToFix.current = true;
    setSearchedAreaLabel(shop.name);
    setMode("Map");
    setPinnedShop(shop);
    selectNearby(shop.externalId);
    flyTo(shop.lat, shop.lng, 16);
  };

  const searchResultShop = (r: ShopResult) => (r.kind === "shop" ? searchShop(r.shop) : searchNearbyShop(r.shop));
  const clearSearch = () => setQuery("");

  const startAdding = (name: string) => {
    setQuery("");
    selectRated(null);
    setMode("Map");
    setListCollapsed(false);
    setAdding(name);
  };
  const confirmAdd = (name: string) => {
    const at = bounds ? boundsCenter(bounds) : center;
    setAdding(null);
    router.push({ pathname: "/log", params: { externalId: newShopId(), name, lat: String(at.lat), lng: String(at.lng) } });
  };
  const addBar = adding !== null ? <AddShopBar initialName={adding} onCancel={() => setAdding(null)} onConfirm={confirmAdd} /> : null;

  const areaHeight = height - tabBarHeight;
  // List mode takes the whole page — nothing useful shows through the sliver of map
  // behind a partial sheet once you've chosen to browse the list instead of the pins.
  const sheetHeight = mode === "List" ? areaHeight : Math.min(316, Math.round(areaHeight * 0.42));

  const map = (
    <MapView
      bottomInset={desktop || adding !== null ? 0 : sheetHeight}
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

  const list = (wide: boolean) =>
    searching ? (
      <SearchResults
        query={query}
        places={sections.places}
        shops={sections.shops}
        pending={search.pending || search.results === null}
        origin={origin}
        wide={wide}
        activeKey={activeKey}
        webAppUrl={WEB_APP_URL}
        onSelectPlace={searchPlace}
        onPressShop={searchResultShop}
        onAddMissing={startAdding}
      />
    ) : (
      <>
        {guide ? (
          <Pressable
            onPress={() => Linking.openURL(`${WEB_APP_URL}/city-guides/${guide.slug}`)}
            accessibilityRole="link"
            style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.rule2 }}
          >
            <Label style={{ color: colors.oxblood }}>{`Read the ${guide.name} guide →`}</Label>
          </Pressable>
        ) : null}
        <ShopListView
          rows={rows}
          activeKey={activeKey}
          wide={wide}
          status={status}
          offline={!online}
          fallbackLabel={userCenter || locationLoading ? null : startCenter.name}
          onPressRow={onPressRow}
          onRetry={reload}
        />
      </>
    );

  const countLabel = searching ? "Search" : `${total} ${total === 1 ? "shop" : "shops"} nearby`;
  // null until something's actually been searched — the bar shows the "Search a
  // city or a shop" invite by default, not a "Near you" label nobody asked for.
  const areaLabel = searchedAreaLabel;

  if (desktop) {
    return (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.paper }}>
        {!listCollapsed && (
          <View style={{ width: PANEL_WIDTH, borderRightWidth: 1, borderRightColor: colors.rule, backgroundColor: colors.paper }}>
            <View style={{ paddingTop: 16, paddingBottom: 12, gap: 13, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
              {/* Row, like the mobile controls bar — MapSearch's flex: 1 collapses its height in a column. */}
              <View style={{ flexDirection: "row", paddingHorizontal: 20 }}>
                <MapSearch areaLabel={areaLabel} count={total} value={query} onChangeText={setQuery} onClear={clearSearch} />
              </View>
              <FilterChips value={filter} onChange={setFilter} />
            </View>
            <View style={{ flex: 1 }}>{list(true)}</View>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          {map}
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {/* Straddles the panel/map seam either way, so it's always reachable. */}
            <Pressable
              onPress={() => setListCollapsed((c) => !c)}
              accessibilityRole="button"
              accessibilityLabel={listCollapsed ? "Show the shop list" : "Hide the shop list"}
              style={{
                position: "absolute",
                left: 0,
                top: 16,
                width: 22,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.rule,
                borderLeftWidth: 0,
              }}
            >
              <ChevronIcon direction={listCollapsed ? "right" : "left"} color={colors.ink} size={11} />
            </Pressable>
            <View style={{ position: "absolute", top: 16, right: 16 }}>
              <ZoomControls onZoom={zoom} onLocate={locate} locateDisabled={!userCenter} onRefresh={reload} />
            </View>
            {adding !== null ? (
              <>
                <Crosshair />
                <View style={{ position: "absolute", left: 16, bottom: 16, width: 380, maxWidth: "90%" }}>{addBar}</View>
              </>
            ) : preview ? (
              <View style={{ position: "absolute", left: 16, bottom: 16, width: 360, maxWidth: "90%" }}>{preview}</View>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      {map}
      {adding !== null ? <Crosshair /> : null}
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: "space-between" }]}>
        <View pointerEvents="box-none">
          <MapTopBar
            areaLabel={areaLabel}
            count={total}
            onLocate={locate}
            locateDisabled={!userCenter}
            onRefresh={reload}
            query={query}
            onQueryChange={setQuery}
            onSearchFocus={() => setMode("List")}
            onSearchClear={clearSearch}
          />
          <FilterChips value={filter} onChange={setFilter} />
        </View>
        {addBar ?? (
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
        )}
      </View>
    </View>
  );
}
