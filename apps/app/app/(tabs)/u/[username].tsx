import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

// Placeholder — the real profile page is built in phase U1.
export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>@{username} (not yet built)</Text>
    </View>
  );
}
