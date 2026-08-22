import { useState } from "react";
import { View, TextInput, StyleSheet, Pressable, Text } from "react-native";
import { Link, router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { supabase } from "@/lib/supabase";
import { ScriptLogo, D1, Body, BodySm, ButtonOx, Label } from "@/components/primitives";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      if (signInError.message.toLowerCase().includes("email not confirmed")) {
        router.push({ pathname: "/check-email", params: { reason: "confirm" } });
        return;
      }
      setError(signInError.message);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <ScriptLogo height={40} color={colors.oxblood} />
        <D1 style={styles.headline}>Find coffee worth{"\n"}the detour.</D1>
        <Body style={styles.subhead}>
          A locator kept by the people who drink it. Sign in to pick up where you left off.
        </Body>
      </View>

      <View style={styles.form}>
        <Label style={styles.fieldLabel}>Email</Label>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          testID="sign-in-email"
        />

        <View style={styles.passwordRow}>
          <Label style={styles.fieldLabel}>Password</Label>
          <Link href="/forgot-password" replace>
            <Label style={styles.link}>Forgotten?</Label>
          </Link>
        </View>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          testID="sign-in-password"
        />

        {error && <BodySm style={styles.error}>{error}</BodySm>}

        <ButtonOx
          title={loading ? "Signing in…" : "Continue"}
          onPress={onSubmit}
          disabled={loading}
          style={styles.submit}
        />
      </View>

      <View style={styles.footer}>
        <BodySm style={{ color: colors.ink3 }}>New here? </BodySm>
        <Link href="/sign-up" replace>
          <Label style={styles.link}>Create an account</Label>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  header: { backgroundColor: colors.sage, padding: 24, paddingTop: 60, paddingBottom: 30 },
  headline: { color: colors.oxblood, marginTop: 22, fontSize: 32 },
  subhead: { color: colors.oxblood, opacity: 0.8, marginTop: 12, maxWidth: 280 },
  form: { flex: 1, padding: 24, paddingTop: 26 },
  fieldLabel: { marginBottom: 8 },
  input: { borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 9, fontSize: 15, color: colors.ink },
  passwordRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 18,
    marginBottom: 8,
  },
  link: { color: colors.tealDk },
  error: { color: colors.oxblood, marginTop: 12 },
  submit: { marginTop: 22 },
  footer: { padding: 24, paddingBottom: 30, flexDirection: "row", justifyContent: "center" },
});
