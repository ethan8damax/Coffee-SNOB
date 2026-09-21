import { useState } from "react";
import { View, TextInput, StyleSheet, Platform } from "react-native";
import { Link, router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { supabase } from "@/lib/supabase";
import { D1, Body, BodySm, ButtonOx, Label } from "@/components/primitives";

export default function SignUpScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    // The confirm link lands on /verified in this same app (web); Supabase only honors this
    // if the origin is in the project's Auth redirect allow-list, else it falls back to Site URL.
    const emailRedirectTo = Platform.OS === "web" ? `${window.location.origin}/verified` : undefined;
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (!data.session) {
      router.push({ pathname: "/check-email", params: { reason: "confirm" } });
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <D1 style={styles.headline}>Create an{"\n"}account.</D1>
        <Body style={styles.subhead}>Onboarding takes about a minute after this.</Body>
      </View>

      <View style={styles.form}>
        <Label style={styles.fieldLabel}>Email</Label>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Label style={[styles.fieldLabel, styles.passwordLabel]}>Password</Label>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />

        {error && <BodySm style={styles.error}>{error}</BodySm>}

        <ButtonOx
          title={loading ? "Creating…" : "Continue"}
          onPress={onSubmit}
          disabled={loading}
          style={styles.submit}
        />
      </View>

      <View style={styles.footer}>
        <BodySm style={{ color: colors.ink3 }}>Already have an account? </BodySm>
        <Link href="/sign-in" replace>
          <Label style={styles.link}>Sign in</Label>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  header: { backgroundColor: colors.sage, padding: 24, paddingTop: 60, paddingBottom: 30 },
  headline: { color: colors.oxblood, fontSize: 32 },
  subhead: { color: colors.oxblood, opacity: 0.8, marginTop: 12, maxWidth: 280 },
  form: { flex: 1, padding: 24, paddingTop: 26 },
  fieldLabel: { marginBottom: 8 },
  passwordLabel: { marginTop: 18 },
  input: { borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 9, fontSize: 15, color: colors.ink },
  error: { color: colors.oxblood, marginTop: 12 },
  submit: { marginTop: 22 },
  link: { color: colors.tealDk },
  footer: { padding: 24, paddingBottom: 30, flexDirection: "row", justifyContent: "center" },
});
