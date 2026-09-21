import { ScrollView, Pressable, Text } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { DRINKS } from "../../lib/log/verdicts";

// Single-select; tap the selected drink again to clear it.
export function DrinkChips({ value, onChange }: { value: string | null; onChange: (d: string | null) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {DRINKS.map((d) => {
        const on = value === d;
        return (
          <Pressable
            key={d}
            onPress={() => onChange(on ? null : d)}
            accessibilityRole="button"
            accessibilityLabel={d}
            accessibilityState={{ selected: on }}
            style={{
              minHeight: 44,
              paddingHorizontal: 14,
              justifyContent: "center",
              borderRadius: 2,
              borderWidth: 1,
              borderColor: on ? colors.ink : colors.rule,
              backgroundColor: on ? colors.ink : "transparent",
            }}
          >
            <Text
              style={{
                fontFamily: "AreaExtended-Bold",
                fontSize: 8.5,
                letterSpacing: 0.85,
                textTransform: "uppercase",
                color: on ? colors.paper : colors.ink2,
              }}
            >
              {d}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
