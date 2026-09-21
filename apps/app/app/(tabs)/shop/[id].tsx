import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

// Placeholder — the real shop page is built in phase M3.
export default function ShopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Shop {id} (not yet built)</Text>
    </View>
  );
}
