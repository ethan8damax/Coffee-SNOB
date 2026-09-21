import { View, Text, Pressable } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { formatDistance, rowSubtitle, type ListRow } from "../../lib/map/shop-list";
import { Detour } from "../detour";
import { D4, Label } from "../primitives";
import { pinStyleForRating } from "./pin-style";

// v1 has no photos, so the design's photo tile becomes a lettered tile whose
// tone follows the verdict (same tiers as the map pins).
export function ShopTile({ row, size }: { row: ListRow; size: number }) {
  const rated = row.kind === "rated";
  const tone = rated ? pinStyleForRating(row.shop.rating) : null;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tone ? tone.background : colors.paper2,
        borderWidth: 1,
        borderColor: tone ? tone.border : colors.rule,
      }}
    >
      <Text style={{ fontFamily: "AreaExtended-Black", fontSize: size * 0.4, color: tone ? tone.foreground : colors.ink3 }}>
        {row.shop.name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

export function rowKey(row: ListRow): string {
  return row.kind === "rated" ? `r:${row.shop.id}` : `n:${row.shop.externalId}`;
}

export function ShopRow({ row, active, wide, onPress }: { row: ListRow; active: boolean; wide: boolean; onPress: () => void }) {
  const subtitle = rowSubtitle(row);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${row.shop.name}, ${subtitle}`}
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: wide ? 13 : 12,
        paddingVertical: wide ? 14 : 12,
        paddingHorizontal: 20,
        minHeight: 44,
        borderBottomWidth: 1,
        borderBottomColor: colors.rule2,
        borderLeftWidth: 2,
        borderLeftColor: active && wide ? colors.burnt : "transparent",
        backgroundColor: active ? (wide ? colors.card : colors.paper2) : "transparent",
      }}
    >
      <ShopTile row={row} size={wide ? 64 : 48} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <D4 numberOfLines={1} style={{ flexShrink: 1, fontSize: wide ? 17 : 20, lineHeight: wide ? 22 : 25 }}>
            {row.shop.name}
          </D4>
          {row.distanceKm !== null ? (
            <Text numberOfLines={1} style={{ marginLeft: "auto", flexShrink: 0, fontFamily: "AreaExtended-Black", fontSize: 9, color: colors.ink3 }}>{formatDistance(row.distanceKm)}</Text>
          ) : null}
        </View>
        <Label numberOfLines={1} style={{ marginTop: 5, marginBottom: row.kind === "rated" ? 7 : 0 }}>
          {subtitle}
        </Label>
        {row.kind === "rated" ? <Detour value={row.shop.rating} /> : null}
      </View>
    </Pressable>
  );
}
