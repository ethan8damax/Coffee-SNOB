import { View } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { Body, D1, Label } from "../primitives";
import type { GuideFeedCard } from "../../lib/feed/types";

export function GuideCard({ item }: { item: GuideFeedCard }) {
  return (
    <View style={{ backgroundColor: colors.sage, padding: 20 }}>
      <Label style={{ color: colors.oxblood }}>{item.cityName ? `City guide · ${item.cityName}` : "City guide"}</Label>
      <D1 style={{ color: colors.oxblood, marginTop: 10, fontSize: 30, lineHeight: 30 }}>{item.title}</D1>
      {item.description && <Body style={{ color: colors.oxblood, marginTop: 10 }}>{item.description}</Body>}
      <Label style={{ color: colors.oxblood, marginTop: 16 }}>{item.shopCount} stops · Read the guide</Label>
    </View>
  );
}
