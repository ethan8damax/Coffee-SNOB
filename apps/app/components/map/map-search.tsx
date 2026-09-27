import { useRef, useState } from "react";
import { Text, TextInput } from "react-native";
import { Tap } from "@/components/tap";
import { colors } from "@coffeesnob/design-tokens";
import { CloseIcon, PinIcon } from "./map-icons";

export const SEARCH_LABEL = "Search a city or a shop";

// The map's area pill doubles as a search box. It's only the input: results
// replace the shop list itself (see search-results.tsx), not a dropdown.
// Nothing fires on its own — "Search a city or a shop" is the permanent invite
// until you actually type.
export function MapSearch({
  areaLabel,
  count,
  value,
  onChangeText,
  onFocus,
  onClear,
}: {
  // null = nothing searched yet, shows the SEARCH_LABEL invite.
  areaLabel: string | null;
  count: number;
  value: string;
  onChangeText: (text: string) => void;
  onFocus?: () => void;
  onClear: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const active = editing || value !== "";

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
      <Tap
        onPress={() => {
          setEditing(true);
          onFocus?.();
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        accessibilityRole="button"
        accessibilityLabel={SEARCH_LABEL}
        style={pillBase}
      >
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
          {areaLabel ?? SEARCH_LABEL}
        </Text>
        <Text style={{ marginLeft: "auto", fontFamily: "AreaExtended-Black", fontSize: 9, color: colors.ink3 }}>{count}</Text>
      </Tap>
    );
  }

  return (
    <Tap feedback="none" onPress={() => inputRef.current?.focus()} style={pillBase} accessible={false}>
      <PinIcon color={colors.oxblood} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => {
          setEditing(true);
          onFocus?.();
        }}
        onBlur={() => setEditing(false)}
        placeholder={SEARCH_LABEL}
        placeholderTextColor={colors.ink3}
        accessibilityLabel={SEARCH_LABEL}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={{ flex: 1, minWidth: 0, fontFamily: "Area-Regular", fontSize: 15, color: colors.ink }}
      />
      <Tap
        onPress={() => {
          setEditing(false);
          inputRef.current?.blur();
          onClear();
        }}
        accessibilityRole="button"
        accessibilityLabel="Clear search"
        hitSlop={12}
      >
        <CloseIcon size={12} color={colors.ink3} />
      </Tap>
    </Tap>
  );
}
