import { View, StyleSheet } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { D2, Body, Label } from "@/components/primitives";

export default function CheckEmailScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const isReset = reason === "reset";

  return (
    <View style={styles.screen}>
      <D2 style={styles.headline}>Check your email.</D2>
      <Body style={styles.body}>
        {isReset
          ? "We sent a link to reset your password. Open it on this device to continue."
          : "We sent a confirmation link. Open it, then come back and sign in."}
      </Body>
      <Link href="/sign-in" replace style={styles.link}>
        <Label style={{ color: colors.tealDk }}>Back to sign in</Label>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, padding: 24, paddingTop: 100, alignItems: "flex-start" },
  headline: { marginBottom: 14 },
  body: { maxWidth: 280, marginBottom: 24 },
  link: { marginTop: 8 },
});
