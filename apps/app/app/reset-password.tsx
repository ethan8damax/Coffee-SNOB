import { useEffect, useRef, useState } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { D2, Body, BodySm, ButtonOx, Label } from "@/components/primitives";

export default function ResetPasswordScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { session } = useAuth();
  const [exchanging, setExchanging] = useState(!session);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (session || attempted.current) {
      setExchanging(false);
      return;
    }
    attempted.current = true;
    if (!code) {
      setExchangeError("This reset link is missing its code. Request a new one.");
      setExchanging(false);
      return;
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) setExchangeError(error.message);
      setExchanging(false);
    });
  }, [code, session]);

  async function onSubmit() {
    setSubmitError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    router.replace("/");
  }

  if (exchanging) {
    return (
      <View style={styles.screen}>
        <Body>Verifying your link…</Body>
      </View>
    );
  }

  if (exchangeError) {
    return (
      <View style={styles.screen}>
        <D2 style={styles.headline}>That link didn't work.</D2>
        <BodySm style={styles.error}>{exchangeError}</BodySm>
        <Link href="/sign-in" replace style={styles.backLink}>
          <Label style={{ color: colors.tealDk }}>Back to sign in</Label>
        </Link>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <D2 style={styles.headline}>Set a new password.</D2>

      <Label style={styles.fieldLabel}>New password</Label>
      <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />

      {submitError && <BodySm style={styles.error}>{submitError}</BodySm>}

      <ButtonOx
        title={submitting ? "Saving…" : "Save password"}
        onPress={onSubmit}
        disabled={submitting}
        style={styles.submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, padding: 24, paddingTop: 100 },
  headline: { marginBottom: 20 },
  fieldLabel: { marginBottom: 8 },
  input: { borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 9, fontSize: 15, color: colors.ink },
  error: { color: colors.oxblood, marginTop: 12 },
  submit: { marginTop: 22 },
  backLink: { marginTop: 20 },
});
