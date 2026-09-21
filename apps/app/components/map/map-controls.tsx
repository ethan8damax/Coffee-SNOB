import { View, Text, Pressable, ScrollView } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { MAP_FILTERS, type MapFilter } from "../../lib/map/shop-list";
import { Chip } from "../chip";
import { LocateIcon } from "./locate-icon";
import { MinusIcon, PinIcon, PlusIcon } from "./map-icons";

// Chips sit on the map, so an inactive chip needs a solid ground to stay legible.
export function FilterChips({ value, onChange, padding = 20 }: { value: MapFilter; onChange: (f: MapFilter) => void; padding?: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5, paddingHorizontal: padding }} accessibilityRole="tablist">
      {MAP_FILTERS.map((f) => {
        const active = value === f.id;
        return (
          <View key={f.id} accessibilityState={{ selected: active }} style={{ backgroundColor: active ? "transparent" : colors.card }}>
            <Chip label={f.label} variant={active ? "ox" : "default"} onPress={() => onChange(f.id)} />
          </View>
        );
      })}
    </ScrollView>
  );
}

export function ViewToggle({ value, onChange }: { value: "Map" | "List"; onChange: (v: "Map" | "List") => void }) {
  return (
    <View style={{ flexDirection: "row", borderWidth: 1, borderColor: colors.rule, borderRadius: 2, backgroundColor: colors.card }}>
      {(["Map", "List"] as const).map((v) => {
        const active = value === v;
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            accessibilityRole="button"
            accessibilityLabel={`${v} view`}
            accessibilityState={{ selected: active }}
            style={{ height: 32, minWidth: 44, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: active ? colors.ink : "transparent" }}
          >
            <Text style={{ fontFamily: "AreaExtended-Bold", fontSize: 8.5, letterSpacing: 0.85, textTransform: "uppercase", color: active ? colors.paper : colors.ink3 }}>{v}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function LocateButton({ onPress, disabled, size = 44 }: { onPress: () => void; disabled: boolean; size?: number }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={disabled ? "Location unavailable" : "Use my location"}
      accessibilityState={{ disabled }}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 2,
        borderWidth: 1,
        borderColor: colors.ink,
        backgroundColor: colors.card,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <LocateIcon color={colors.ink} />
    </Pressable>
  );
}

// Desktop map controls (design: wide.jsx MapCanvas top-right stack).
export function ZoomControls({ onZoom, onLocate, locateDisabled }: { onZoom: (delta: 1 | -1) => void; onLocate: () => void; locateDisabled: boolean }) {
  const box = { width: 40, height: 40, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.rule };
  return (
    <View style={{ gap: 1 }}>
      <Pressable onPress={() => onZoom(1)} accessibilityRole="button" accessibilityLabel="Zoom in" style={box}>
        <PlusIcon color={colors.ink} />
      </Pressable>
      <Pressable onPress={() => onZoom(-1)} accessibilityRole="button" accessibilityLabel="Zoom out" style={box}>
        <MinusIcon color={colors.ink} />
      </Pressable>
      <LocateButton onPress={onLocate} disabled={locateDisabled} size={40} />
    </View>
  );
}

// Phone top bar: where you are + how many shops are in view, and locate-me.
// (The design's city pill becomes an area pill — v1 has no cities.)
export function MapTopBar({ areaLabel, count, onLocate, locateDisabled }: { areaLabel: string; count: number; onLocate: () => void; locateDisabled: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 }}>
      <View
        accessibilityRole="header"
        style={{
          flex: 1,
          height: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
          paddingHorizontal: 11,
          borderWidth: 1,
          borderColor: colors.rule,
          borderRadius: 2,
          backgroundColor: colors.card,
        }}
      >
        <PinIcon color={colors.oxblood} />
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: "AreaExtended-Bold", fontSize: 8.5, letterSpacing: 1.19, textTransform: "uppercase", color: colors.ink }}>
          {areaLabel}
        </Text>
        <Text style={{ marginLeft: "auto", fontFamily: "AreaExtended-Black", fontSize: 9, color: colors.ink3 }}>{count}</Text>
      </View>
      <LocateButton onPress={onLocate} disabled={locateDisabled} />
    </View>
  );
}
