import { View } from "react-native";
import { Tap } from "@/components/tap";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { Avatar, D4, Label } from "../primitives";
import type { CollectionFeedCard } from "../../lib/feed/types";

export function CollectionCard({ item }: { item: CollectionFeedCard }) {
  return (
    <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.rule2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <Avatar name={item.curatorName} size={26} />
        <Label style={{ color: colors.ink3 }}>Collected by</Label>
        <Label style={{ color: colors.ink }}>{item.curatorName}</Label>
      </View>
      <Tap
        onPress={() => router.push(`/collection/${item.id}`)}
        accessibilityRole="link"
        accessibilityLabel={`${item.title}, a collection of ${item.shopCount} shops`}
        style={{ borderWidth: 1, borderColor: colors.rule, borderRadius: 2, padding: 14, backgroundColor: colors.card }}
      >
        <Label style={{ color: colors.oxblood }}>A collection · {item.shopCount} shops</Label>
        <D4 style={{ marginTop: 7 }}>{item.title}</D4>
      </Tap>
    </View>
  );
}
