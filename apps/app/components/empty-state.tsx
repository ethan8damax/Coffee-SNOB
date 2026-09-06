import { View } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { Body } from "./primitives";

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.paper }}>
      <Body style={{ textAlign: "center", color: colors.ink3, maxWidth: 260 }}>{message}</Body>
    </View>
  );
}
