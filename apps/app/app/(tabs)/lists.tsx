import { View, Text } from "react-native";
import { useAuth } from "@/context/auth";
import { SignInPrompt } from "@/components/sign-in-prompt";

export default function ListsScreen() {
  const { session } = useAuth();
  if (!session) return <SignInPrompt message="Sign in to see your collections." />;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Collections (not yet built)</Text>
    </View>
  );
}
