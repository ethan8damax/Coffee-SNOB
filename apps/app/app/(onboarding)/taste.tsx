import { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { saveTastePicks } from "@coffeesnob/supabase";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { D1, D4, Body, BodySm, Label, ButtonOx, IconCheck } from "@/components/primitives";

const OPTIONS = [
  { id: "espresso", label: "Espresso, standing", sub: "Single or ristretto, down at the bar." },
  { id: "filter", label: "Filter, sitting", sub: "V60, Aeropress, batch. The slower the better." },
  { id: "milk", label: "Milk drinks", sub: "Cortado, flat white, the occasional cappuccino." },
  { id: "iced", label: "Cold", sub: "Cold brew, iced filter, oat shaken." },
  { id: "trust", label: "Whatever's on bar", sub: "You'd rather the barista chose." },
];

export default function TasteScreen() {
  const { session, refreshProfile } = useAuth();
  const [picks, setPicks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function onSubmit() {
    if (!session) return;
    setError(null);
    setSaving(true);
    try {
      await saveTastePicks(supabase, session.user.id, picks);
      const refreshed = await refreshProfile();
      if (!refreshed) {
        setError("Saved, but couldn't confirm — tap Continue to try again.");
        return;
      }
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Label style={styles.step}>Step two · Taste</Label>
        <D1 style={styles.headline}>Tell us how{"\n"}you take it.</D1>
        <Body style={styles.subhead}>
          We'll shape the guide around you — and put the shops that do your thing well at the top of the map.
        </Body>
      </View>

      <View style={styles.list}>
        {OPTIONS.map((o) => {
          const on = picks.includes(o.id);
          return (
            <Pressable key={o.id} onPress={() => toggle(o.id)} style={[styles.row, on && styles.rowOn]}>
              <View style={[styles.checkbox, on && styles.checkboxOn]}>{on && <IconCheck size={13} color={colors.cream} />}</View>
              <View style={styles.rowText}>
                <D4>{o.label}</D4>
                <BodySm style={{ color: colors.ink3, marginTop: 5 }}>{o.sub}</BodySm>
              </View>
            </Pressable>
          );
        })}
        {error && <BodySm style={styles.error}>{error}</BodySm>}
      </View>

      <View style={styles.footer}>
        <ButtonOx title={saving ? "Saving…" : "Continue"} onPress={onSubmit} disabled={saving} />
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
  list: { flex: 1 },
  row: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    padding: 16,
    paddingHorizontal: 22,
  },
  rowOn: { backgroundColor: colors.card },
  checkbox: {
    width: 20,
    height: 20,
    marginTop: 2,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: colors.ink3,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { borderWidth: 0, backgroundColor: colors.oxblood },
  rowText: { flex: 1 },
  error: { color: colors.oxblood, margin: 22, marginBottom: 0 },
  footer: { padding: 22, paddingBottom: 30 },
});
