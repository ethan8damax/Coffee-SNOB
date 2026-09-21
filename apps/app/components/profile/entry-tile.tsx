import { View, Pressable, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import type { ProfileEntry } from "@coffeesnob/supabase";
import { Label } from "@/components/primitives";
import { DETOUR_LABELS } from "@/components/detour-style";
import { entryNumber, tileGround } from "@/lib/profile/profile-helpers";

function Chevron({ filled }: { filled: boolean }) {
  return (
    <Svg width={7} height={8.5} viewBox="0 0 9 11">
      <Path d="M1.5 1.5 6 5.5l-4.5 4" stroke={colors.cream} strokeOpacity={filled ? 1 : 0.28} strokeWidth={2.6} fill="none" />
    </Svg>
  );
}

// No photos in v1: a solid ground, a bottom scrim, the shop and its chevrons.
// ponytail: CSS gradient via RN-web's style passthrough; native ignores it (v1 is web).
const scrim = { backgroundImage: "linear-gradient(to bottom, rgba(22,19,16,0), rgba(22,19,16,0.72))" } as ViewStyle;

export function EntryTile({
  entry,
  index,
  total,
  columns,
}: {
  entry: ProfileEntry;
  index: number;
  total: number;
  columns: number;
}) {
  const n = entryNumber(index, total);
  const rating = Math.max(1, Math.min(5, Math.round(entry.rating)));
  return (
    <View style={{ width: `${100 / columns}%`, aspectRatio: 3 / 4, padding: 1 }}>
      <Pressable
        onPress={() => router.push(`/shop/${entry.shopId}`)}
        accessibilityRole="button"
        accessibilityLabel={`${entry.shopName}, ${DETOUR_LABELS[rating - 1]}, entry ${n}`}
        style={{ flex: 1, backgroundColor: tileGround(index), justifyContent: "flex-end", overflow: "hidden" }}
      >
        <Label style={{ position: "absolute", top: 7, right: 8, color: colors.cream, opacity: 0.8 }}>№{n}</Label>
        <View style={[{ paddingHorizontal: 8, paddingBottom: 8, paddingTop: 28, gap: 5 }, scrim]}>
          <Label numberOfLines={2} style={{ color: colors.cream }}>
            {entry.shopName}
          </Label>
          <View style={{ flexDirection: "row", gap: 2 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Chevron key={i} filled={i <= rating} />
            ))}
          </View>
        </View>
      </Pressable>
    </View>
  );
}
