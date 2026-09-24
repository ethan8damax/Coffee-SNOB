import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { searchRatedShops } from "@coffeesnob/supabase";
import { Label } from "../primitives";
import { searchEverywhere, searchNearbyShops, type Place } from "../../lib/map/geocode";
import { toRatedShopPin } from "../../lib/map/nearby-map-data";
import { mergeResults, rankResults, type SearchResult } from "../../lib/map/search-sort";
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
  const [pending, setPending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!active) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setPending(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      const { supabase } = require("../../lib/supabase");
      // Sources land in stages and the list updates as each arrives, so our
      // own rated shops show instantly instead of waiting on the slowest source.
      let merged: SearchResult[] = [];
      const add = (incoming: SearchResult[]) => {
        if (cancelled) return;
        merged = mergeResults(merged, incoming);
        setResults(rankResults(merged, q, origin));
      };
      setResults(null);
      setPending(true);
      // 1. Our rated shops (anywhere) — instant.
      const rated = searchRatedShops(supabase, q)
        .catch((): Awaited<ReturnType<typeof searchRatedShops>> => [])
        .then((rows) => add(rows.map((row): SearchResult => ({ kind: "shop", shop: toRatedShopPin(row), secondary: row.neighborhood }))));
      // 2. Cafés and places worldwide (Photon) — ~1s.
      // 3. Only if that found few cafés: the local OSM name search, which also
      //    catches coffee-serving restaurants/bars Photon can't filter for.
      const wide = searchEverywhere(q, origin, webAppUrl)
        .catch((): Awaited<ReturnType<typeof searchEverywhere>> => ({ places: [], shops: [] }))
        .then(async ({ places, shops }) => {
          add([
            ...places.map((place): SearchResult => ({ kind: "place", place })),
            ...shops.map(({ shop, secondary }): SearchResult => ({ kind: "nearby", shop, secondary })),
          ]);
          if (shops.length >= 3 || !origin) return;
          const local = await searchNearbyShops(q, origin, webAppUrl).catch(() => []);
          add(local.map((shop): SearchResult => ({ kind: "nearby", shop, secondary: shop.address })));
        });
      Promise.all([rated, wide]).then(() => {
        if (!cancelled) setPending(false);
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
    setPending(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }
  function close() {
    setActive(false);
    setQuery("");
    setResults(null);
    setPending(false);
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
      {(results || pending) && (
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
          {(results ?? []).map((r) => {
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
            })}
          {pending ? (
            <Label style={{ padding: 14, color: colors.ink3 }}>Searching more cafés…</Label>
          ) : results && results.length === 0 ? (
            <Label style={{ padding: 14, color: colors.ink3 }}>No matches.</Label>
          ) : null}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
