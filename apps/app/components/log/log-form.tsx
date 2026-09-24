import { useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { logVisit } from "@coffeesnob/supabase";
import { supabase } from "@/lib/supabase";
import { isDesktopWidth } from "@/lib/nav";
import { Body, BodySm, ButtonBu, D2, Label } from "../primitives";
import { VerdictChips } from "./verdict-chips";
import { DrinkChips } from "./drink-chips";
import { VERDICT_FOOTNOTE } from "../../lib/log/verdicts";
import { NOTE_MAX, buildLogVisitInput, canPublish, type LogParams } from "../../lib/log/params";
import { useShopName } from "../../lib/log/use-shop-name";
import { locateShop } from "../../lib/log/locate";

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? "";

function cancel() {
  if (router.canGoBack()) router.back();
  else router.replace("/map");
}

export function LogForm({ params, userId }: { params: Exclude<LogParams, { kind: "none" }>; userId: string }) {
  const { width } = useWindowDimensions();
  const desktop = isDesktopWidth(width);
  const [rating, setRating] = useState<number | null>(null);
  const [drink, setDrink] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const fetchedName = useShopName(params.kind === "existing" ? params.shopId : null);
  const shopName = params.kind === "osm" ? params.name : (params.name ?? fetchedName);
  const valid = canPublish(params, rating, submitting);

  async function publish() {
    if (inFlight.current) return;
    let input = buildLogVisitInput(params, { rating, drink, note });
    if (!input) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      // A new shop from OSM: find its city so it lands on that city's page.
      if (input.kind === "osm") {
        input = { ...input, ...(await locateShop(input.lat, input.lng, WEB_APP_URL)) };
      }
      const { shopId } = await logVisit(supabase, userId, input);
      // Tab screens stay mounted; clear the form so the next visit starts fresh.
      setRating(null);
      setDrink(null);
      setNote("");
      setSubmitting(false);
      inFlight.current = false;
      router.replace(`/shop/${shopId}`);
    } catch {
      setError("Couldn't save your entry. Give it another go.");
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, alignItems: desktop ? "center" : "stretch" }}
      >
        <View style={{ width: "100%", maxWidth: desktop ? 560 : undefined, paddingHorizontal: 16, paddingBottom: 32 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52 }}>
            <Pressable
              onPress={cancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={{ minHeight: 44, minWidth: 64, justifyContent: "center" }}
            >
              <Label style={{ color: colors.ink2 }}>Cancel</Label>
            </Pressable>
            <Label style={{ color: colors.ink }}>New entry</Label>
            <Pressable
              onPress={publish}
              disabled={!valid}
              accessibilityRole="button"
              accessibilityLabel="Publish"
              accessibilityState={{ disabled: !valid }}
              style={{ minHeight: 44, minWidth: 64, justifyContent: "center", alignItems: "flex-end" }}
            >
              <Label style={{ color: valid ? colors.burnt : colors.ink3 }}>Publish</Label>
            </Pressable>
          </View>

          <View style={{ paddingVertical: 20, gap: 6 }}>
            <Label>Logging</Label>
            <D2 accessibilityRole="header">{shopName ?? " "}</D2>
          </View>

          <View style={{ gap: 12 }}>
            <Label>How far would you go?</Label>
            <VerdictChips value={rating} onChange={setRating} />
            <BodySm>{VERDICT_FOOTNOTE}</BodySm>
          </View>

          <View style={{ gap: 12, marginTop: 28 }}>
            <Label>What you ordered</Label>
            <DrinkChips value={drink} onChange={setDrink} />
          </View>

          <View style={{ gap: 12, marginTop: 28 }}>
            <Label>Your note</Label>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={NOTE_MAX}
              placeholder="What earned it, or lost it? Be specific."
              placeholderTextColor={colors.ink3}
              accessibilityLabel="Your note"
              style={{
                minHeight: 110,
                padding: 12,
                textAlignVertical: "top",
                borderWidth: 1,
                borderColor: colors.rule,
                borderRadius: 2,
                backgroundColor: colors.card,
                fontFamily: "Area-Regular",
                fontSize: 14,
                lineHeight: 20,
                color: colors.ink,
              }}
            />
            <BodySm style={{ textAlign: "right" }}>{`${NOTE_MAX - note.length} left`}</BodySm>
          </View>

          {error ? (
            <Text accessibilityRole="alert" style={{ marginTop: 16, fontFamily: "Area-Regular", fontSize: 13.5, color: colors.oxblood }}>
              {error}
            </Text>
          ) : null}

          <ButtonBu
            title={submitting ? "Publishing" : "Publish entry"}
            icon={submitting ? <ActivityIndicator color={colors.ink} /> : undefined}
            disabled={!valid}
            accessibilityRole="button"
            accessibilityLabel="Publish entry"
            accessibilityState={{ disabled: !valid, busy: submitting }}
            onPress={publish}
            style={{ marginTop: 24, opacity: valid || submitting ? 1 : 0.45 }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
