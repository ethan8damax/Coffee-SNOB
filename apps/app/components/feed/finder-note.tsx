import { useEffect, useState } from "react";
import { View } from "react-native";
import { Tap } from "@/components/tap";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { getUnreadNotifications, markNotificationRead, type FinderNotification } from "@coffeesnob/supabase";
import { supabase } from "@/lib/supabase";
import { BodySm, D4, Label } from "../primitives";

// Credit the finder (Curation Phase 6): the first person to log a shop hears
// when it's Snob-Approved; whoever added a shop hears when it's decided (0036).
// One note at a time, newest first.
function copy(note: FinderNotification) {
  if (note.kind === "shop_added")
    return { kicker: "On the map", title: `${note.shopName} is on the map.`, body: "You added it. The first entry could be yours.", open: `/shop/${note.shopId}` };
  if (note.kind === "shop_declined")
    return { kicker: "Passed", title: `We passed on ${note.shopName}.`, body: note.reason ?? "It didn't clear the bar this time. Thanks for sending it.", open: "/my-shops" };
  return { kicker: "You found it first", title: `${note.shopName} is Snob-Approved.`, body: "You were the first to log it. We went twice. It earned the pin.", open: `/shop/${note.shopId}` };
}

export function FinderNote() {
  const [notes, setNotes] = useState<FinderNotification[]>([]);
  useEffect(() => {
    getUnreadNotifications(supabase).then(setNotes, () => setNotes([]));
  }, []);
  const note = notes[0];
  if (!note) return null;
  const c = copy(note);

  const done = () => {
    setNotes((n) => n.slice(1));
    markNotificationRead(supabase, note.id).catch(() => {});
  };

  return (
    <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.rule2 }}>
      <Tap
        onPress={() => {
          done();
          router.push(c.open as never);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${c.title} ${note.kind === "shop_declined" ? "See your shops." : "Open the shop."}`}
        style={{ borderWidth: 1, borderColor: colors.ink, borderRadius: 2, padding: 14, backgroundColor: colors.card }}
      >
        <Label style={{ color: note.kind === "shop_declined" ? colors.ink2 : colors.oxblood }}>{c.kicker}</Label>
        <D4 style={{ marginTop: 7 }}>{c.title}</D4>
        <BodySm style={{ marginTop: 6, color: colors.ink2 }}>{c.body}</BodySm>
      </Tap>
      <Tap onPress={done} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={8} style={{ alignSelf: "flex-end", minHeight: 36, justifyContent: "center" }}>
        <Label style={{ color: colors.ink3 }}>Got it</Label>
      </Tap>
    </View>
  );
}
