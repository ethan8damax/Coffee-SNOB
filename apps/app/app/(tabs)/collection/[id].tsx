import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { Body, ButtonLine, ButtonOx } from "@/components/primitives";
import { CollectionView } from "@/components/collections/collection-view";
import { useCollection } from "@/lib/collections/use-collections";

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16, backgroundColor: colors.paper }}>{children}</View>;
}

// Public route: anyone can open a public collection; private ones read as gone.
export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const collection = useCollection(id);

  if (collection.status === "error") {
    return (
      <Centered>
        <Body style={{ textAlign: "center", color: colors.ink3, maxWidth: 260 }}>{"Couldn't load this collection. Check your connection and try again."}</Body>
        <ButtonOx title="Try again" onPress={collection.retry} accessibilityRole="button" accessibilityLabel="Try again" />
      </Centered>
    );
  }
  if (collection.status !== "ready" && !collection.data) {
    return (
      <Centered>
        <ActivityIndicator color={colors.ink3} accessibilityLabel="Loading collection" />
      </Centered>
    );
  }
  if (!collection.data) {
    return (
      <Centered>
        <Body style={{ textAlign: "center", color: colors.ink3, maxWidth: 260 }}>This collection is private or gone.</Body>
        <ButtonLine title="Back to the map" onPress={() => router.replace("/map")} accessibilityRole="button" accessibilityLabel="Back to the map" />
      </Centered>
    );
  }
  return <CollectionView key={collection.data.id} collection={collection.data} onChanged={collection.retry} />;
}
