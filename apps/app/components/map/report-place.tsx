import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { flagPlace, getMyPlaceFlags, type PlaceFlagKind } from "@coffeesnob/supabase";
import { useAuth } from "@/context/auth";
import { Chip } from "../chip";
import { BodySm, Label } from "../primitives";
import type { NearbyShopPin } from "./types";

const KINDS: { kind: PlaceFlagKind; label: string }[] = [
  { kind: "closed", label: "Closed" },
  { kind: "not_specialty", label: "Not specialty" },
  { kind: "wrong_location", label: "Wrong spot" },
];

// "Something off?" on a coffee index café (curation Phase 3). One tap sends a
// report; two people saying "closed" hides it until we look.
export function ReportPlace({ shop }: { shop: NearbyShopPin }) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<PlaceFlagKind[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !session) return;
    let cancelled = false;
    const { supabase } = require("@/lib/supabase");
    getMyPlaceFlags(supabase, shop.externalId).then(
      (kinds) => !cancelled && setSent(kinds),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [open, session, shop.externalId]);

  const send = async (kind: PlaceFlagKind) => {
    setProblem(null);
    setSent((s) => [...s, kind]);
    try {
      const { supabase } = require("@/lib/supabase");
      await flagPlace(supabase, { placeId: shop.externalId, placeName: shop.name, lat: shop.lat, lng: shop.lng, kind });
    } catch (e) {
      setSent((s) => s.filter((k) => k !== kind));
      setProblem(e instanceof Error && /too many/i.test(e.message) ? "That's a lot of reports for one day. Try tomorrow." : "Couldn't send that. Try again.");
    }
  };

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Report a problem with ${shop.name}`} style={{ minHeight: 32, justifyContent: "center", alignSelf: "flex-start" }}>
        <Label style={{ color: colors.ink3, textDecorationLine: "underline" }}>Something off?</Label>
      </Pressable>
    );
  }

  if (!session) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 32 }}>
        <BodySm style={{ color: colors.ink2 }}>Reports need an account.</BodySm>
        <Pressable onPress={() => router.push("/sign-in")} accessibilityRole="link" style={{ minHeight: 32, justifyContent: "center" }}>
          <Label style={{ color: colors.ink, textDecorationLine: "underline" }}>Sign in</Label>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {KINDS.map(({ kind, label }) =>
          sent.includes(kind) ? (
            <Chip key={kind} label={`${label} · sent`} variant="on" />
          ) : (
            <Chip key={kind} label={label} onPress={() => send(kind)} />
          ),
        )}
      </View>
      {problem ? (
        <BodySm style={{ color: colors.oxblood }}>{problem}</BodySm>
      ) : sent.length ? (
        <BodySm style={{ color: colors.ink2 }}>Thanks. We'll take a look.</BodySm>
      ) : null}
    </View>
  );
}
