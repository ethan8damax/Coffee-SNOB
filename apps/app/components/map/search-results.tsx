import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import type { Place } from "../../lib/map/geocode";
import { toListRow, type ShopResult } from "../../lib/map/search-sort";
import { Label } from "../primitives";
import { ShopRow, rowKey } from "./shop-row";

function SectionLabel({ children }: { children: string }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.rule2 }}>
      <Label style={{ color: colors.ink3 }}>{children}</Label>
    </View>
  );
}

// Search results, in place of the shop list: places to move the map to, then
// shops. Same rows as the nearby list so a result reads like a list entry.
export function SearchResults({
  query,
  places,
  shops,
  pending,
  origin,
  wide,
  activeKey,
  webAppUrl,
  onSelectPlace,
  onPressShop,
  onAddMissing,
}: {
  query: string;
  places: Place[];
  shops: ShopResult[];
  pending: boolean;
  origin: { lat: number; lng: number } | null;
  wide: boolean;
  activeKey: string | null;
  webAppUrl: string;
  onSelectPlace: (place: Place) => void;
  onPressShop: (result: ShopResult) => void;
  onAddMissing?: (name: string) => void;
}) {
  const empty = !pending && places.length === 0 && shops.length === 0;
  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      {places.length > 0 ? <SectionLabel>Places</SectionLabel> : null}
      {places.map((place) => (
        <View key={place.id} style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.rule2 }}>
          <Pressable
            onPress={() => onSelectPlace(place)}
            accessibilityRole="button"
            accessibilityLabel={place.secondary ? `${place.primary}, ${place.secondary}` : place.primary}
            style={{ flex: 1, minHeight: 52, justifyContent: "center", gap: 2, paddingHorizontal: 20, paddingVertical: 10 }}
          >
            <Text numberOfLines={1} style={{ fontFamily: "Area-Bold", fontSize: 15, color: colors.ink }}>{place.primary}</Text>
            {place.secondary ? <Text numberOfLines={1} style={{ fontFamily: "Area-Regular", fontSize: 12, color: colors.ink3 }}>{place.secondary}</Text> : null}
          </Pressable>
          {/* Only cities with a curated editorial guide get this (the server decides). */}
          {place.guideSlug ? (
            <Pressable
              onPress={() => Linking.openURL(`${webAppUrl}/city-guides/${place.guideSlug}`)}
              accessibilityRole="link"
              accessibilityLabel={`Read the ${place.primary} guide`}
              style={{ minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: 20 }}
            >
              <Label style={{ color: colors.oxblood }}>Guide →</Label>
            </Pressable>
          ) : null}
        </View>
      ))}
      {shops.length > 0 ? <SectionLabel>Shops</SectionLabel> : null}
      {shops.map((r) => {
        const row = toListRow(r, origin);
        return <ShopRow key={rowKey(row)} row={row} active={rowKey(row) === activeKey} wide={wide} onPress={() => onPressShop(r)} />;
      })}
      {pending ? (
        <Label style={{ padding: 20, color: colors.ink3 }}>Searching more cafés…</Label>
      ) : empty ? (
        <Text style={{ padding: 20, fontFamily: "Area-Regular", fontSize: 14, color: colors.ink2 }}>{`Nothing called “${query.trim()}” that we can find.`}</Text>
      ) : null}
      {!pending && onAddMissing ? (
        <Pressable
          onPress={() => onAddMissing(query.trim())}
          accessibilityRole="button"
          accessibilityLabel="Add a shop that's missing from the map"
          style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 20 }}
        >
          <Label style={{ color: colors.oxblood }}>Not on the map? Add it</Label>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
