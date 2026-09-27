import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { getUnreadNotifications, markNotificationRead, type FinderNotification } from "@coffeesnob/supabase";
import { supabase } from "@/lib/supabase";
import { BodySm, D4, Label } from "../primitives";

// Credit the finder (Curation Phase 6): the first person to log a shop hears
// when it's Snob-Approved. One note at a time, newest first.
export function FinderNote() {
  const [notes, setNotes] = useState<FinderNotification[]>([]);
  useEffect(() => {
    getUnreadNotifications(supabase).then(setNotes, () => setNotes([]));
  }, []);
  const note = notes[0];
  if (!note) return null;

  const done = () => {
    setNotes((n) => n.slice(1));
    markNotificationRead(supabase, note.id).catch(() => {});
  };

  return (
    <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.rule2 }}>
      <Pressable
        onPress={() => {
          done();
          router.push(`/shop/${note.shopId}`);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${note.shopName} is Snob-Approved. Open the shop.`}
        style={{ borderWidth: 1, borderColor: colors.ink, borderRadius: 2, padding: 14, backgroundColor: colors.card }}
      >
        <Label style={{ color: colors.oxblood }}>You found it first</Label>
        <D4 style={{ marginTop: 7 }}>{`${note.shopName} is Snob-Approved.`}</D4>
        <BodySm style={{ marginTop: 6, color: colors.ink2 }}>You were the first to log it. We went twice. It earned the pin.</BodySm>
      </Pressable>
      <Pressable onPress={done} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={8} style={{ alignSelf: "flex-end", minHeight: 36, justifyContent: "center" }}>
        <Label style={{ color: colors.ink3 }}>Got it</Label>
      </Pressable>
    </View>
  );
}
