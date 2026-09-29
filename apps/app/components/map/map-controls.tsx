import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { Modal, View, Text, StyleSheet, type ViewStyle } from "react-native";
import { Tap, type TapFeedback } from "@/components/tap";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@coffeesnob/design-tokens";
import { EFFORT_OPTIONS, YOU_OPTIONS, type MapFilter } from "../../lib/map/shop-list";
import { chipStyleForVariant } from "../chip-style";
import { Enter } from "../enter";
import { LocateIcon } from "./locate-icon";
import { MapSearch } from "./map-search";
import { MinusIcon, PinIcon, PlusIcon } from "./map-icons";

function FilterMenu<T extends string>({
  title,
  value,
  options,
  open,
  onToggle,
  onChange,
}: {
  title: string;
  value: T;
  options: { id: T; label: string }[];
  open: boolean;
  onToggle: () => void;
  onChange: (v: T) => void;
}) {
  const on = value !== "any";
  // The menu opens in a transparent modal so a tap anywhere outside it (list,
  // map, header) closes it; it's placed under the chip by measuring the chip.
  const chip = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const current = options.find((o) => o.id === value)?.label ?? "";
  const s = chipStyleForVariant(on ? "ox" : "default");
  return (
    <View>
      <Tap
        ref={chip}
        onPress={() => {
          if (open) return onToggle();
          chip.current?.measureInWindow((x, y, _w, h) => {
            setAnchor({ x, y: y + h + 4 });
            onToggle();
          });
        }}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${current}`}
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 2, borderWidth: 1, borderColor: s.border, backgroundColor: on ? s.background : colors.card }}
      >
        <Text style={{ fontFamily: "AreaExtended-Bold", fontSize: 8.5, letterSpacing: 0.85, textTransform: "uppercase", color: s.text }}>
          {on ? current : title}
        </Text>
        <Text style={{ fontSize: 9, color: s.text }}>▾</Text>
      </Tap>
      <Modal visible={open && anchor !== null} transparent animationType="none" onRequestClose={onToggle}>
        <Tap feedback="none" style={StyleSheet.absoluteFill} onPress={onToggle} accessibilityLabel={`Close ${title} menu`} />
        <Enter
          accessibilityRole="menu"
          rise={-4}
          duration={160}
          style={{ position: "absolute", top: anchor?.y ?? 0, left: anchor?.x ?? 0, minWidth: 200, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.rule, borderRadius: 2, paddingVertical: 4 }}
        >
          {options.map((o) => {
            const selected = o.id === value;
            return (
              <Tap feedback="tint"
                key={o.id}
                onPress={() => onChange(o.id)}
                accessibilityRole="menuitem"
                accessibilityState={{ selected }}
                style={{ minHeight: 40, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 }}
              >
                <Text style={{ width: 10, fontSize: 10, color: colors.oxblood }}>{selected ? "●" : ""}</Text>
                <Text style={{ fontFamily: selected ? "Area-Bold" : "Area-Regular", fontSize: 14, color: colors.ink }}>{o.label}</Text>
              </Tap>
            );
          })}
        </Enter>
      </Modal>
    </View>
  );
}

// Effort ▾ and You ▾ (signed in only). They sit on the map, so a closed chip
// needs a solid ground to stay legible. Picking an option closes the menu.
export function FilterChips({ value, onChange, signedIn, padding = 20 }: { value: MapFilter; onChange: (f: MapFilter) => void; signedIn: boolean; padding?: number }) {
  const [open, setOpen] = useState<"effort" | "you" | null>(null);
  return (
    <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: padding }}>
      <FilterMenu
        title="Effort"
        value={value.effort}
        options={EFFORT_OPTIONS}
        open={open === "effort"}
        onToggle={() => setOpen(open === "effort" ? null : "effort")}
        onChange={(effort) => {
          setOpen(null);
          onChange({ ...value, effort });
        }}
      />
      {signedIn ? (
        <FilterMenu
          title="You"
          value={value.you}
          options={YOU_OPTIONS}
          open={open === "you"}
          onToggle={() => setOpen(open === "you" ? null : "you")}
          onChange={(you) => {
            setOpen(null);
            onChange({ ...value, you });
          }}
        />
      ) : null}
    </View>
  );
}

export function ViewToggle({ value, onChange }: { value: "Map" | "List"; onChange: (v: "Map" | "List") => void }) {
  return (
    <View style={{ flexDirection: "row", borderWidth: 1, borderColor: colors.rule, borderRadius: 2, backgroundColor: colors.card }}>
      {(["Map", "List"] as const).map((v) => {
        const active = value === v;
        return (
          <Tap
            key={v}
            onPress={() => onChange(v)}
            accessibilityRole="button"
            accessibilityLabel={`${v} view`}
            accessibilityState={{ selected: active }}
            style={{ height: 32, minWidth: 44, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: active ? colors.ink : "transparent" }}
          >
            <Text style={{ fontFamily: "AreaExtended-Bold", fontSize: 8.5, letterSpacing: 0.85, textTransform: "uppercase", color: active ? colors.paper : colors.ink3 }}>{v}</Text>
          </Tap>
        );
      })}
    </View>
  );
}

export function LocateButton({
  onPress,
  disabled,
  size = 44,
  style,
  feedback,
}: {
  onPress: () => void;
  disabled: boolean;
  size?: number;
  // The desktop stack passes its flat box and "outline" hover instead.
  style?: ViewStyle;
  feedback?: TapFeedback;
}) {
  return (
    <Tap
      feedback={feedback}
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
        ...style,
      }}
    >
      <LocateIcon color={colors.ink} />
    </Tap>
  );
}

// Desktop map controls (design: wide.jsx MapCanvas top-right stack).
export function ZoomControls({
  onZoom,
  onLocate,
  locateDisabled,
}: {
  onZoom: (delta: 1 | -1) => void;
  onLocate: () => void;
  locateDisabled: boolean;
}) {
  // One flat look for the whole stack; hover lifts each to card + ink border.
  const box = { width: 40, height: 40, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.rule };
  return (
    <View style={{ gap: 1 }}>
      <Tap feedback="outline" onPress={() => onZoom(1)} accessibilityRole="button" accessibilityLabel="Zoom in" style={box}>
        <PlusIcon color={colors.ink} />
      </Tap>
      <Tap feedback="outline" onPress={() => onZoom(-1)} accessibilityRole="button" accessibilityLabel="Zoom out" style={box}>
        <MinusIcon color={colors.ink} />
      </Tap>
      <LocateButton onPress={onLocate} disabled={locateDisabled} size={40} style={box} feedback="outline" />
    </View>
  );
}

// The phone's top bar: the search pill full width, plus whatever the view
// needs beside it (List view puts its Map/List switch there). Locate lives
// on the map itself, by the thumb.
export function MapTopBar({
  areaLabel,
  count,
  query,
  onQueryChange,
  onSearchFocus,
  onSearchClear,
  trailing,
  startEditing,
}: {
  areaLabel: string | null;
  count: number;
  query: string;
  onQueryChange: (text: string) => void;
  onSearchFocus: () => void;
  onSearchClear: () => void;
  trailing?: ReactNode;
  startEditing?: boolean;
}) {
  // The map draws edge-to-edge under the status bar/notch (see
  // public/index.html), so this bar needs a real inset-aware top padding —
  // a fixed one would either float in the notch's cutout on a phone with a
  // tall one (Dynamic Island) or leave dead space on one without.
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 10 }}>
      <MapSearch areaLabel={areaLabel} count={count} value={query} onChangeText={onQueryChange} onFocus={onSearchFocus} onClear={onSearchClear} startEditing={startEditing} />
      {trailing}
    </View>
  );
}
