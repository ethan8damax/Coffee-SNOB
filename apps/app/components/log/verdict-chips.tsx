import { View, Text, Pressable } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@coffeesnob/design-tokens";
import { Label } from "../primitives";
import { VERDICTS, type VerdictFill } from "../../lib/log/verdicts";

const SELECTED: Record<VerdictFill, { bg: string; border: string; text: string; sub: string; chevron: string }> = {
  outline: { bg: colors.card, border: colors.ink, text: colors.ink, sub: colors.ink2, chevron: colors.burnt },
  burnt: { bg: colors.burnt, border: colors.burnt, text: colors.ink, sub: colors.ink, chevron: colors.ink },
  oxblood: { bg: colors.oxblood, border: colors.oxblood, text: colors.cream, sub: colors.cream, chevron: colors.cream },
};

function Chevrons({ count, color }: { count: number; color: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Svg key={i} width={7} height={9} viewBox="0 0 9 11">
          <Path d="M1.5 1.5 6 5.5l-4.5 4" stroke={color} strokeOpacity={i <= count ? 1 : 0.28} strokeWidth={2.6} fill="none" />
        </Svg>
      ))}
    </View>
  );
}

export function VerdictChips({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
      {VERDICTS.map((v) => {
        const selected = value === v.value;
        const s = selected ? SELECTED[v.fill] : { bg: "transparent", border: colors.rule, text: colors.ink, sub: colors.ink3, chevron: colors.burnt };
        return (
          <Pressable
            key={v.value}
            onPress={() => onChange(v.value)}
            accessibilityRole="radio"
            accessibilityLabel={`${v.word}. ${v.sub}`}
            accessibilityState={{ selected, checked: selected }}
            style={{
              minHeight: 56,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 2,
              borderWidth: selected && v.fill === "outline" ? 2 : 1,
              borderColor: s.border,
              backgroundColor: s.bg,
            }}
          >
            <Chevrons count={v.value} color={s.chevron} />
            <View style={{ flex: 1, gap: 2 }}>
              <Label style={{ color: s.text, fontSize: 10, letterSpacing: 1.2 }}>{v.word}</Label>
              <Text style={{ fontFamily: "Area-Regular", fontSize: 12, lineHeight: 16, color: s.sub }}>{v.sub}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
