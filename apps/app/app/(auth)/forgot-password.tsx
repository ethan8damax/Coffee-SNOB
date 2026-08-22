import { useState } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { router, Link } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { supabase } from "@/lib/supabase";
import { D2, Body, BodySm, ButtonOx, Label } from "@/components/primitives";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "coffeesnob://reset-password",
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    router.push({ pathname: "/check-email", params: { reason: "reset" } });
  }

  return (
    <View style={styles.screen}>
      <D2 style={styles.headline}>Reset your password.</D2>
      <Body style={styles.body}>We'll email you a link to set a new one.</Body>

      <Label style={styles.fieldLabel}>Email</Label>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      {error && <BodySm style={styles.error}>{error}</BodySm>}

      <ButtonOx
        title={loading ? "Sending…" : "Send reset link"}
        onPress={onSubmit}
        disabled={loading}
        style={styles.submit}
      />

      <Link href="/sign-in" replace style={styles.backLink}>
        <Label style={{ color: colors.tealDk }}>Back to sign in</Label>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, padding: 24, paddingTop: 100 },
  headline: { marginBottom: 14 },
  body: { maxWidth: 280, marginBottom: 26 },
  fieldLabel: { marginBottom: 8 },
  input: { borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 9, fontSize: 15, color: colors.ink },
  error: { color: colors.oxblood, marginTop: 12 },
  submit: { marginTop: 22 },
  backLink: { marginTop: 20 },
});
