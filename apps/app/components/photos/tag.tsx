import { View, type StyleProp, type ViewStyle } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { Tap } from "@/components/tap";
import { Label } from "../primitives";

// The black tag on photos and map headers (photos spec, section 7): ink ground,
// cream label, sharp corners. Always sits in a corner of whatever it credits.
export function Tag({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: colors.ink, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 2 }, style]}>
      <Label style={{ color: colors.cream }}>{label}</Label>
    </View>
  );
}

// "Photo by @username", linking to their profile.
export function CreditTag({ username, style }: { username: string | null; style?: StyleProp<ViewStyle> }) {
  if (!username) return null;
  return (
    <Tap
      onPress={() => router.push(`/u/${username}`)}
      accessibilityRole="link"
      accessibilityLabel={`Photo by ${username}. Open their profile`}
      hitSlop={8}
      style={style}
    >
      <Tag label={`Photo by @${username}`} />
    </Tap>
  );
}
