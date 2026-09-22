import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { searchRatedShops } from "@coffeesnob/supabase";
import { Label } from "../primitives";
import { geocodePlaces, type Place } from "../../lib/map/geocode";
import { toRatedShopPin } from "../../lib/map/nearby-map-data";
import { sortByDistance, type SearchResult } from "../../lib/map/search-sort";
import { CloseIcon, PinIcon } from "./map-icons";
import type { RatedShopPin } from "./types";

const DEBOUNCE_MS = 350;

// The map's area pill doubles as a search box: tap it, type a city or a shop name,
// pick a result. "Near you" (or the fallback area) is the untouched default — this
// never fires on its own, only on a tap.
export function MapSearch({
  areaLabel,
  count,
  webAppUrl,
  origin,
  onSelectPlace,
  onSelectShop,
}: {
  areaLabel: string;
  count: number;
  webAppUrl: string;
  // Roughly "where the searcher is" (real location, or the current map center) —
  // used only to rank results near-first, never sent anywhere.
  origin: { lat: number; lng: number } | null;
  onSelectPlace: (place: Place) => void;
  onSelectShop: (shop: RatedShopPin) => void;
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
    const timer = setTimeout(() => {
      const { supabase } = require("../../lib/supabase");
      Promise.all([geocodePlaces(q, webAppUrl).catch(() => []), searchRatedShops(supabase, q).catch(() => [])]).then(([places, shopRows]) => {
        const combined: SearchResult[] = [
          ...places.map((place): SearchResult => ({ kind: "place", place })),
          ...shopRows.map((row): SearchResult => ({ kind: "shop", shop: toRatedShopPin(row) })),
        ];
        setResults(sortByDistance(combined, origin));
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
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
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel="Search a city or a shop" style={pillBase}>
        <PinIcon color={colors.oxblood} />
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: "AreaExtended-Bold", fontSize: 8.5, letterSpacing: 1.19, textTransform: "uppercase", color: colors.ink }}>
          {areaLabel}
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
          placeholder="Search a city or a shop"
          placeholderTextColor={colors.ink3}
          accessibilityLabel="Search a city or a shop"
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
            zIndex: 20,
          }}
        >
          {results.length === 0 ? (
            <Label style={{ padding: 14, color: colors.ink3 }}>No matches.</Label>
          ) : (
            results.map((r) => {
              const key = r.kind === "place" ? `p:${r.place.id}` : `s:${r.shop.id}`;
              const title = r.kind === "place" ? r.place.displayName : r.shop.name;
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    if (r.kind === "place") onSelectPlace(r.place);
                    else onSelectShop(r.shop);
                    close();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={title}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.rule2 }}
                >
                  <Label style={{ color: colors.ink3, width: 40 }}>{r.kind === "place" ? "Place" : "Shop"}</Label>
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: "Area-Regular", fontSize: 13, color: colors.ink }}>
                    {title}
                  </Text>
                </Pressable>
              );
            })
          )}
          <Label style={{ padding: 10, color: colors.ink3, fontSize: 9 }}>Places © OpenStreetMap contributors.</Label>
        </View>
      )}
    </View>
  );
}
