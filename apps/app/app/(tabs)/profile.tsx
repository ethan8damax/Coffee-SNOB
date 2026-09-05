import { View, Text, Pressable } from "react-native";
import { useAuth } from "@/context/auth";
import { SignInPrompt } from "@/components/sign-in-prompt";

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  if (!session) return <SignInPrompt message="Sign in to see your profile." />;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
      <Text>Profile (not yet built)</Text>
      <Pressable onPress={signOut}>
        <Text style={{ textDecorationLine: "underline" }}>Sign out</Text>
      </Pressable>
    </View>
  );
}
