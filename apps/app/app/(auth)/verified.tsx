import { View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { D2, Body, ButtonOx } from "@/components/primitives";

// Where the email-confirmation link lands. Supabase has already confirmed the address by the
// time we get here; the user just signs in with the password they chose.
export default function VerifiedScreen() {
  return (
    <View style={styles.screen}>
      <D2 style={styles.headline}>You're verified.</D2>
      <Body style={styles.body}>Your email is confirmed. Sign in to start logging coffee.</Body>
      <ButtonOx title="Sign in" onPress={() => router.replace("/sign-in")} accessibilityRole="button" accessibilityLabel="Sign in" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, padding: 24, paddingTop: 100, alignItems: "flex-start" },
  headline: { marginBottom: 14 },
  body: { maxWidth: 280, marginBottom: 24 },
});
