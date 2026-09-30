import { View } from "react-native";
import { Tap } from "@/components/tap";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { BodySm, Label } from "../primitives";
import { useSent } from "../../lib/tell-us/use-sent";
import { sentCounts, sentLine, sentRows } from "../../lib/tell-us/sent";

// Own profile only: what you've told us and where it stands, one tap from the list.
export function SentLink({ userId }: { userId: string }) {
  const sent = useSent(userId);
  if (sent.status !== "ready" || !sent.data) return null;
  const rows = sentRows(sent.data.shops, sent.data.reports, sent.data.messages);
  const line = sentLine(sentCounts(sent.data.shops, rows), rows.length);
  const empty = rows.length === 0;
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
      <Tap
        feedback="tint"
        onPress={() => router.push(empty ? { pathname: "/map", params: { add: "1" } } : "/sent")}
        accessibilityRole="button"
        accessibilityLabel={empty ? "Add a shop the map is missing" : `What you've sent. ${line}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.rule, borderRadius: 2 }}
      >
        <View style={{ flex: 1, gap: 4, paddingVertical: 10 }}>
          <Label>{empty ? "Shops you added" : "What you've sent"}</Label>
          <BodySm style={{ color: colors.ink2 }}>{line}</BodySm>
        </View>
        <Label style={{ color: colors.oxblood }}>{empty ? "Add" : "See all"}</Label>
      </Tap>
    </View>
  );
}
