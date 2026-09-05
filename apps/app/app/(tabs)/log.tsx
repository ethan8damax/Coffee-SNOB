import { View, Text } from "react-native";
import { useAuth } from "@/context/auth";
import { SignInPrompt } from "@/components/sign-in-prompt";

export default function LogScreen() {
  const { session } = useAuth();
  if (!session) return <SignInPrompt message="Sign in to log a visit." />;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Log a visit (not yet built)</Text>
    </View>
  );
}
