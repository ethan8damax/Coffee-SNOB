import type { ReactNode } from "react";
import { View, Text } from "react-native";
import { Tap } from "@/components/tap";
import { chipStyleForVariant, type ChipVariant } from "./chip-style";

export function Chip({
  label,
  variant = "default",
  icon,
  onPress,
}: {
  label: string;
  variant?: ChipVariant;
  icon?: ReactNode;
  onPress?: () => void;
}) {
  const s = chipStyleForVariant(variant);
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        height: 27,
        paddingHorizontal: 11,
        borderRadius: 2,
        borderWidth: 1,
        borderColor: s.border,
        backgroundColor: s.background,
      }}
    >
      {icon}
      <Text style={{ fontFamily: "AreaExtended-Bold", fontSize: 8.5, letterSpacing: 0.85, textTransform: "uppercase", color: s.text }}>{label}</Text>
    </View>
  );
  return onPress ? (
    <Tap onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {body}
    </Tap>
  ) : (
    body
  );
}
