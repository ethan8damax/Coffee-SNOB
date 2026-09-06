import { View, Text } from "react-native";
import Svg, { Path } from "react-native-svg";
import { detourStyleForValue, DETOUR_LABELS } from "./detour-style";

function Chevron({ filled, color }: { filled: boolean; color: string }) {
  return (
    <Svg width={5.5} height={7} viewBox="0 0 9 11">
      <Path d="M1.5 1.5 6 5.5l-4.5 4" stroke={color} strokeOpacity={filled ? 1 : 0.32} strokeWidth={2.6} fill="none" />
    </Svg>
  );
}

export function Detour({ value }: { value: number }) {
  const v = Math.max(1, Math.min(5, Math.round(value)));
  const style = detourStyleForValue(v);
  return (
    <View
      style={{
        flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", height: 26,
        paddingHorizontal: 10, borderRadius: 2, borderWidth: 1, borderColor: style.border, backgroundColor: style.background,
      }}
    >
      <View style={{ flexDirection: "row", gap: 1.5 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Chevron key={i} filled={i <= v} color={style.chevron} />
        ))}
      </View>
      <Text style={{ fontFamily: "AreaExtended-Bold", fontSize: 8.5, letterSpacing: 1.19, textTransform: "uppercase", color: style.text }}>
        {DETOUR_LABELS[v - 1]}
      </Text>
    </View>
  );
}
