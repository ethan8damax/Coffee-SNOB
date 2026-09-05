import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { SignInPrompt } from "@/components/sign-in-prompt";

export default function HomeScreen() {
  const { session } = useAuth();
  const [cityCount, setCityCount] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("cities")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setCityCount(count ?? 0));
  }, []);

  if (!session) return <SignInPrompt message="Sign in to see what's near you." />;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Home — discovery feed (not yet built)</Text>
      <Text>{cityCount === null ? "Loading cities…" : `${cityCount} cities in Supabase`}</Text>
    </View>
  );
}
