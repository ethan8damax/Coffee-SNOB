import { View } from "react-native";
import { Tap } from "@/components/tap";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { BodySm, Label } from "../primitives";
import { useMySubmissions } from "../../lib/add-shop/use-my-submissions";
import { addedLine, submissionCounts } from "../../lib/add-shop/summary";

// Own profile only: the shops you've put on the map, one tap from the list.
export function AddedShopsLink({ userId }: { userId: string }) {
  const mine = useMySubmissions(userId);
  if (mine.status !== "ready" || !mine.data) return null;
  const counts = submissionCounts(mine.data);
  const empty = mine.data.length === 0;
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
      <Tap
        feedback="tint"
        onPress={() => router.push(empty ? { pathname: "/map", params: { add: "1" } } : "/my-shops")}
        accessibilityRole="button"
        accessibilityLabel={empty ? "Add a shop the map is missing" : `Shops you added. ${addedLine(counts)}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.rule, borderRadius: 2 }}
      >
        <View style={{ flex: 1, gap: 4, paddingVertical: 10 }}>
          <Label>Shops you added</Label>
          <BodySm style={{ color: colors.ink2 }}>{addedLine(counts)}</BodySm>
        </View>
        <Label style={{ color: colors.oxblood }}>{empty ? "Add" : "See all"}</Label>
      </Tap>
    </View>
  );
}
