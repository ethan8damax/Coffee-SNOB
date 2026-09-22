import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { searchRatedShops } from "@coffeesnob/supabase";
import { Label } from "../primitives";
import { geocodePlaces, reverseGeocode, searchNearbyShops, type Place } from "../../lib/map/geocode";
import { toRatedShopPin } from "../../lib/map/nearby-map-data";
import { sortByDistance, type SearchResult } from "../../lib/map/search-sort";
import { CloseIcon, PinIcon } from "./map-icons";
import type { NearbyShopPin, RatedShopPin } from "./types";

const DEBOUNCE_MS = 350;
const DEFAULT_LABEL = "Search a city or a shop";

// The map's area pill doubles as a search box: tap it, type a city or a shop name, pick
// a result. Nothing fires on its own — "Search a city or a shop" is the permanent
// invite until you actually pick something.
export function MapSearch({
  areaLabel,
  count,
  webAppUrl,
  origin,
  onSelectPlace,
  onSelectShop,
  onSelectNearbyShop,
}: {
  // null = nothing searched yet, shows the DEFAULT_LABEL invite.
  areaLabel: string | null;
  count: number;
  webAppUrl: string;
  // Ranks results near-first: what's on screen if we're looking at the map, else the
  // real device location. Never sent anywhere. Also anchors the "search a shop by
  // name" radius — without it, unrated shops aren't searched (no anchor point).
  origin: { lat: number; lng: number } | null;
  onSelectPlace: (place: Place) => void;
  onSelectShop: (shop: RatedShopPin) => void;
  onSelectNearbyShop: (shop: NearbyShopPin) => void;
}) {
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!active) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      const { supabase } = require("../../lib/supabase");
      Promise.all([
        geocodePlaces(q, webAppUrl).catch(() => []),
        searchRatedShops(supabase, q).catch(() => []),
        // Most early searches are someone looking for a shop they've already been
        // to, to rate or favorite it for the first time — it won't be rated yet,
        // so it has to come from live OSM data too, not just searchRatedShops.
        origin ? searchNearbyShops(q, origin, webAppUrl).catch(() => []) : Promise.resolve([]),
      ]).then(async ([places, shopRows, nearby]) => {
        const shops = shopRows.map(toRatedShopPin);
        // One reverse lookup per shop match (city/state/country from its coordinates) —
        // in parallel and awaited together, so the list appears once, fully formed,
        // rather than filling in row by row.
        const [shopSecondaries, nearbySecondaries] = await Promise.all([
          Promise.all(shops.map((s) => reverseGeocode(s.lat, s.lng, webAppUrl).catch(() => null))),
          Promise.all(nearby.map((s) => reverseGeocode(s.lat, s.lng, webAppUrl).catch(() => null))),
        ]);
        if (cancelled) return;
        const combined: SearchResult[] = [
          ...places.map((place): SearchResult => ({ kind: "place", place })),
          ...shops.map((shop, i): SearchResult => ({ kind: "shop", shop, secondary: shopSecondaries[i] })),
          ...nearby.map((shop, i): SearchResult => ({ kind: "nearby", shop, secondary: nearbySecondaries[i] })),
        ];
        setResults(sortByDistance(combined, origin));
      });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, query, webAppUrl, origin]);

  function open() {
    setActive(true);
    setQuery("");
    setResults(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }
  function close() {
    setActive(false);
    setQuery("");
    setResults(null);
  }

  const pillBase = {
    flex: 1,
    height: 44,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 7,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 2,
    backgroundColor: colors.card,
  };

  if (!active) {
    return (
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={DEFAULT_LABEL} style={pillBase}>
        <PinIcon color={colors.oxblood} />
        <Text
          numberOfLines={1}
          style={{
            flexShrink: 1,
            fontFamily: "AreaExtended-Bold",
            fontSize: 8.5,
            letterSpacing: 1.19,
            textTransform: "uppercase",
            color: areaLabel ? colors.ink : colors.ink3,
          }}
        >
          {areaLabel ?? DEFAULT_LABEL}
        </Text>
        <Text style={{ marginLeft: "auto", fontFamily: "AreaExtended-Black", fontSize: 9, color: colors.ink3 }}>{count}</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ flex: 1, zIndex: 30 }}>
      <View style={pillBase}>
        <PinIcon color={colors.oxblood} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder={DEFAULT_LABEL}
          placeholderTextColor={colors.ink3}
          accessibilityLabel={DEFAULT_LABEL}
          autoCapitalize="none"
          style={{ flex: 1, fontFamily: "Area-Regular", fontSize: 13, color: colors.ink }}
        />
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Cancel search" hitSlop={8}>
          <CloseIcon size={12} color={colors.ink3} />
        </Pressable>
      </View>
      {results && (
        <View
          style={{
            position: "absolute",
            top: 48,
            left: 0,
            right: 0,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.rule,
            borderRadius: 2,
            maxHeight: 280,
            overflow: "hidden",
            zIndex: 20,
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 280 }}>
          {results.length === 0 ? (
            <Label style={{ padding: 14, color: colors.ink3 }}>No matches.</Label>
          ) : (
            results.map((r) => {
              const key = r.kind === "place" ? `p:${r.place.id}` : r.kind === "shop" ? `s:${r.shop.id}` : `n:${r.shop.externalId}`;
              // Whatever the searcher actually matched — the shop name, or the finest
              // place Nominatim resolved to (a city, a state, or just a country) — is
              // the bold headline; the rest (if any) trails smaller beneath it.
              const primary = r.kind === "place" ? r.place.primary : r.shop.name;
              const secondary = r.kind === "place" ? r.place.secondary : r.secondary;
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    if (r.kind === "place") onSelectPlace(r.place);
                    else if (r.kind === "shop") onSelectShop(r.shop);
                    else onSelectNearbyShop(r.shop);
                    close();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={secondary ? `${primary}, ${secondary}` : primary}
                  style={{ gap: 2, minHeight: 44, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.rule2 }}
                >
                  <Text numberOfLines={1} style={{ fontFamily: "Area-Bold", fontSize: 13.5, color: colors.ink }}>
                    {primary}
                  </Text>
                  {!!secondary && (
                    <Text numberOfLines={1} style={{ fontFamily: "Area-Regular", fontSize: 11.5, color: colors.ink3 }}>
                      {secondary}
                    </Text>
                  )}
                </Pressable>
              );
            })
          )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
