import type { ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import type { ListRow } from "../../lib/map/shop-list";
import { formatDistance, rowSubtitle } from "../../lib/map/shop-list";
import { Detour } from "../detour";
import { BodySm, D2, D4, Label } from "../primitives";
import { ArrowIcon, CloseIcon, PlusIcon } from "./map-icons";
import { ShopTile } from "./shop-row";
import { ReportPlace } from "./report-place";
import { whyLine } from "../../lib/map/coffee-index";

function ActionButton({ title, icon, solid, onPress, label }: { title: string; icon?: ReactNode; solid?: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: solid ? 1 : undefined,
        height: 44,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        borderRadius: 2,
        backgroundColor: solid ? colors.oxblood : "transparent",
        borderWidth: solid ? 0 : 1,
        borderColor: colors.ink,
      }}
    >
      {icon}
      <Text style={{ fontFamily: "AreaExtended-Black", fontSize: 8.5, letterSpacing: 0.85, textTransform: "uppercase", color: solid ? colors.cream : colors.ink }}>
        {title}
      </Text>
    </Pressable>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", margin: -10 }}>
      <CloseIcon color={colors.ink3} />
    </Pressable>
  );
}

// Compact pin preview (design: map.jsx). A rated pin pushes through to the shop
// page; an unrated dot has no record yet, so logging a visit is what creates one.
export function PreviewCard({
  row,
  onOpen,
  onLog,
  onDirections,
  onDismiss,
}: {
  row: ListRow;
  onOpen: () => void;
  onLog: () => void;
  onDirections: () => void;
  onDismiss: () => void;
}) {
  if (row.kind === "rated") {
    return (
      <View style={{ backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, borderRadius: 2, padding: 12, flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Open ${row.shop.name}`} style={{ flex: 1, flexDirection: "row", gap: 12, alignItems: "center", minWidth: 0 }}>
          <ShopTile row={row} size={56} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
              <D2 numberOfLines={1} style={{ flexShrink: 1, fontSize: 24, lineHeight: 30 }}>
                {row.shop.name}
              </D2>
              {row.distanceKm !== null ? (
                <Text numberOfLines={1} style={{ marginLeft: "auto", flexShrink: 0, fontFamily: "AreaExtended-Black", fontSize: 9, color: colors.ink3 }}>{formatDistance(row.distanceKm)}</Text>
              ) : null}
            </View>
            <Label numberOfLines={1} style={{ marginTop: 5, marginBottom: 7 }}>
              {rowSubtitle(row)}
            </Label>
            <Detour value={row.shop.rating} />
          </View>
          <View style={{ width: 34, height: 34, borderRadius: 2, backgroundColor: colors.oxblood, alignItems: "center", justifyContent: "center" }}>
            <ArrowIcon color={colors.cream} />
          </View>
        </Pressable>
        <CloseButton onPress={onDismiss} />
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.rule, borderRadius: 2, padding: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <D4 numberOfLines={1} style={{ flexShrink: 1, fontSize: 20, lineHeight: 25 }}>
          {row.shop.name}
        </D4>
        <Label style={{ marginLeft: "auto" }}>Not yet rated</Label>
        <CloseButton onPress={onDismiss} />
      </View>
      {row.shop.address ? <Label numberOfLines={1} style={{ marginTop: 6 }}>{row.shop.address}</Label> : null}
      {whyLine(row.shop.why) ? (
        <BodySm numberOfLines={2} style={{ marginTop: 6, color: colors.ink2 }}>
          {whyLine(row.shop.why)}
        </BodySm>
      ) : null}
      <View style={{ flexDirection: "row", gap: 7, marginTop: 11 }}>
        <ActionButton solid title="Log a visit" icon={<PlusIcon size={13} color={colors.cream} />} onPress={onLog} label={`Log a visit to ${row.shop.name}`} />
        <ActionButton title="Directions" onPress={onDirections} label={`Directions to ${row.shop.name}`} />
      </View>
      {row.shop.externalId.startsWith("cs_") ? (
        <View style={{ marginTop: 8 }}>
          <ReportPlace shop={row.shop} />
        </View>
      ) : null}
    </View>
  );
}
