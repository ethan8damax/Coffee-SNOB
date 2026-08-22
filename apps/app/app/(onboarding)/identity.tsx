import { useEffect, useState } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { isUsernameAvailable, saveIdentity } from "@coffeesnob/supabase";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { D1, Body, BodySm, Label, Avatar, ButtonOx, Eyebrow } from "@/components/primitives";

export default function IdentityScreen() {
  const { session, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed || !session) {
      setAvailability("idle");
      return;
    }
    setAvailability("checking");
    const timeout = setTimeout(async () => {
      const available = await isUsernameAvailable(supabase, trimmed, session.user.id);
      setAvailability(available ? "available" : "taken");
    }, 500);
    return () => clearTimeout(timeout);
  }, [username, session]);

  async function onSubmit() {
    if (!session) return;
    setError(null);
    setSaving(true);
    try {
      await saveIdentity(supabase, session.user.id, {
        username: username.trim(),
        displayName: displayName.trim(),
      });
      await refreshProfile();
      router.push("/taste");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = username.trim().length > 0 && displayName.trim().length > 0 && availability !== "taken";

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Label style={styles.step}>Step one · You</Label>
        <D1 style={styles.headline}>First, what{"\n"}we call you.</D1>
        <Body style={styles.subhead}>Your handle is how members find you and credit your notes.</Body>
      </View>

      <View style={styles.form}>
        <Label style={styles.fieldLabel}>Name</Label>
        <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} />

        <View style={styles.usernameRow}>
          <Label style={styles.fieldLabel}>Handle</Label>
          {availability === "checking" && <Label style={{ color: colors.ink3 }}>Checking…</Label>}
          {availability === "available" && <Label style={{ color: colors.tealDk }}>Available</Label>}
          {availability === "taken" && <Label style={{ color: colors.oxblood }}>Already taken</Label>}
        </View>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={(v) => setUsername(v.replace(/\s/g, "").toLowerCase())}
          autoCapitalize="none"
        />

        <View style={styles.preview}>
          <Eyebrow>You'll appear as</Eyebrow>
          <View style={styles.previewRow}>
            <Avatar name={displayName || "?"} size={44} bg={colors.burnt} fg={colors.ink} />
            <View>
              <D1 style={styles.previewName}>{displayName || "Your name"}</D1>
              <BodySm style={{ color: colors.ink3 }}>@{username || "handle"}</BodySm>
            </View>
          </View>
        </View>

        {error && <BodySm style={styles.error}>{error}</BodySm>}
      </View>

      <View style={styles.footer}>
        <ButtonOx
          title={saving ? "Saving…" : "Continue"}
          onPress={onSubmit}
          disabled={!canSubmit || saving}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  header: { backgroundColor: colors.sage, padding: 22, paddingTop: 60, paddingBottom: 22 },
  step: { color: colors.oxblood, opacity: 0.7 },
  headline: { color: colors.burnt, marginTop: 11, fontSize: 34 },
  subhead: { color: colors.oxblood, marginTop: 11, maxWidth: 290, opacity: 0.85 },
  form: { flex: 1, padding: 22, paddingTop: 22 },
  fieldLabel: { marginBottom: 8 },
  usernameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 18 },
  input: { borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 9, fontSize: 15, color: colors.ink },
  preview: { marginTop: 26 },
  previewRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: 14,
    marginTop: 10,
  },
  previewName: { fontSize: 17, lineHeight: 18 },
  error: { color: colors.oxblood, marginTop: 16 },
  footer: { padding: 22, paddingBottom: 30 },
});
