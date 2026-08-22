import { View, Text, Pressable } from "react-native";
import { useAuth } from "@/context/auth";

export default function ProfileScreen() {
  const { signOut } = useAuth();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
      <Text>Profile (not yet built)</Text>
      <Pressable onPress={signOut}>
        <Text style={{ textDecorationLine: "underline" }}>Sign out</Text>
      </Pressable>
    </View>
  );
}
