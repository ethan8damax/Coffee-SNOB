import type { ReactNode } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { BodySm, Label } from "./primitives";

// Labelled field and text input shared by Add a shop and Tell us.
export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10, marginTop: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Label>{label}</Label>
        {required ? <Label style={{ color: colors.ink3, fontSize: 7.5 }}>Required</Label> : null}
      </View>
      {children}
      {hint ? (
        <BodySm accessibilityLiveRegion="polite" style={{ color: colors.oxblood }}>
          {hint}
        </BodySm>
      ) : null}
    </View>
  );
}

export function Input({ bad, style, ...props }: TextInputProps & { bad?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={colors.ink3}
      {...props}
      style={[
        {
          minHeight: 44,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: bad ? colors.oxblood : colors.rule,
          borderRadius: 2,
          backgroundColor: colors.card,
          fontFamily: "Area-Regular",
          fontSize: 16, // 16+ stops iOS zooming on focus
          lineHeight: 20,
          color: colors.ink,
        },
        style,
      ]}
    />
  );
}
