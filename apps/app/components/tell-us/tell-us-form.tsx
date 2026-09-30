import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Tap } from "@/components/tap";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { flagPlace, getMyPlaceFlags, sendMessage, type FlagTarget, type MessageKind, type PlaceFlagKind } from "@coffeesnob/supabase";
import { supabase } from "@/lib/supabase";
import { isDesktopWidth } from "@/lib/nav";
import { chipStyleForVariant } from "../chip-style";
import { Field, Input } from "../form";
import { Body, BodySm, ButtonBu, ButtonOx, D2, Label } from "../primitives";
import { REPORT_LABEL } from "../../lib/tell-us/sent";
import { contextLine, deviceContext } from "../../lib/tell-us/context";

export type Topic = "shop" | MessageKind;
export type ShopRef = FlagTarget & { name: string; lat: number; lng: number };

const NOTE_MAX = 500;
const BODY_MAX = 2000;
const REASONS: PlaceFlagKind[] = ["closed", "wrong_location", "wrong_info", "not_specialty", "duplicate", "other"];

const COPY: Record<MessageKind, { kicker: string; title: string; placeholder: string }> = {
  bug: { kicker: "Something's broken", title: "What broke?", placeholder: "What you did, and what happened instead." },
  idea: { kicker: "An idea", title: "What should we build?", placeholder: "The idea, and when you'd use it." },
  contact: { kicker: "Just saying hi", title: "Go on.", placeholder: "Anything. We read every one." },
};

const leave = () => (router.canGoBack() ? router.back() : router.replace("/map"));

function errorMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? "");
  if (/too many/i.test(m)) return "That's a lot for one day. Try tomorrow.";
  if (/suspended|row-level security/i.test(m)) return "Your account can't send this right now.";
  return "Couldn't send it. Give it another go.";
}

// One screen for everything people tell us. Opened with a topic (and a shop
// for reports) it goes straight to that form; opened bare it asks first.
export function TellUsForm({ topic: initial, shop, from }: { topic: Topic | null; shop: ShopRef | null; from: string }) {
  const { width } = useWindowDimensions();
  const desktop = isDesktopWidth(width);
  const [topic, setTopic] = useState<Topic | null>(initial === "shop" && !shop ? null : initial);
  const [reason, setReason] = useState<PlaceFlagKind | null>(null);
  const [already, setAlready] = useState<PlaceFlagKind[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inFlight = useRef(false);
  const context = deviceContext(from);

  // Reports this person already has open on this shop can't be sent twice.
  useEffect(() => {
    if (topic !== "shop" || !shop) return;
    let cancelled = false;
    getMyPlaceFlags(supabase, shop.shopId ? { shopId: shop.shopId } : { placeId: shop.placeId! }).then(
      (kinds) => !cancelled && setAlready(kinds),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [topic, shop]);

  const valid = !sending && (topic === "shop" ? reason !== null : text.trim().length > 0);

  async function send() {
    if (!valid || !topic || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError(null);
    try {
      if (topic === "shop" && shop && reason) {
        await flagPlace(supabase, { ...(shop.shopId ? { shopId: shop.shopId } : { placeId: shop.placeId! }), placeName: shop.name, lat: shop.lat, lng: shop.lng, kind: reason, note: text });
      } else if (topic !== "shop") {
        await sendMessage(supabase, topic, text, context);
      }
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  const column = { width: "100%", maxWidth: desktop ? 560 : undefined, paddingHorizontal: 16 } as const;

  if (done) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14, backgroundColor: colors.paper }}>
        <Label style={{ color: colors.oxblood }}>Sent</Label>
        <D2 accessibilityRole="header" style={{ textAlign: "center", maxWidth: 420 }}>
          Got it.
        </D2>
        <Body style={{ textAlign: "center", color: colors.ink2, maxWidth: 340 }}>
          {topic === "shop" && shop
            ? `We'll check ${shop.name}. When it's sorted, you'll hear about it at the top of your feed.`
            : "We read every one. If we write back, it comes by email."}
        </Body>
        <ButtonOx title="What you've sent" accessibilityRole="button" onPress={() => router.replace("/sent")} style={{ marginTop: 8, minWidth: 240 }} />
        <Tap onPress={leave} accessibilityRole="button" hitSlop={8} style={{ minHeight: 44, justifyContent: "center" }}>
          <Label style={{ color: colors.ink2 }}>Back</Label>
        </Tap>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, alignItems: desktop ? "center" : "stretch", paddingBottom: 40 }}>
        <View style={column}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52 }}>
            <Tap
              onPress={() => (topic && !initial ? setTopic(null) : leave())}
              accessibilityRole="button"
              accessibilityLabel={topic && !initial ? "Back" : "Cancel"}
              style={{ minHeight: 44, minWidth: 64, justifyContent: "center" }}
            >
              <Label style={{ color: colors.ink2 }}>{topic && !initial ? "Back" : "Cancel"}</Label>
            </Tap>
            <Label style={{ color: colors.ink }}>Tell us</Label>
            <View style={{ minWidth: 64, alignItems: "flex-end" }}>
              {topic ? (
                <Tap onPress={send} disabled={!valid} accessibilityRole="button" accessibilityLabel="Send" accessibilityState={{ disabled: !valid }} style={{ minHeight: 44, justifyContent: "center" }}>
                  <Label style={{ color: valid ? colors.burnt : colors.ink3 }}>Send</Label>
                </Tap>
              ) : null}
            </View>
          </View>
        </View>

        {topic === null ? (
          <Chooser column={column} onPick={setTopic} />
        ) : (
          <View style={column}>
            {topic === "shop" && shop ? (
              <>
                <View style={{ paddingTop: 20, paddingBottom: 8, gap: 6 }}>
                  <Label>Something off</Label>
                  <D2 accessibilityRole="header">{shop.name}</D2>
                </View>
                <Field label="What's off" required>
                  <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {REASONS.map((k) => (
                      <ReasonChip key={k} label={REPORT_LABEL[k]} on={reason === k} sent={already.includes(k)} onPress={() => setReason(k)} />
                    ))}
                  </View>
                </Field>
                <Field label="Anything else">
                  <Input
                    value={text}
                    onChangeText={setText}
                    maxLength={NOTE_MAX}
                    multiline
                    placeholder={reason === "wrong_info" ? "What's right? Hours, name, website." : reason === "duplicate" ? "Which one's the real one?" : "What you saw. Be specific."}
                    accessibilityLabel="Note"
                    style={{ minHeight: 96, paddingTop: 12, textAlignVertical: "top" }}
                  />
                  {text.length > NOTE_MAX - 100 ? <BodySm style={{ textAlign: "right" }}>{`${NOTE_MAX - text.length} left`}</BodySm> : null}
                </Field>
              </>
            ) : topic !== "shop" ? (
              <>
                <View style={{ paddingTop: 20, paddingBottom: 8, gap: 6 }}>
                  <Label>{COPY[topic].kicker}</Label>
                  <D2 accessibilityRole="header">{COPY[topic].title}</D2>
                </View>
                <Field label={topic === "bug" ? "What happened" : "Your note"} required>
                  <Input
                    value={text}
                    onChangeText={setText}
                    maxLength={BODY_MAX}
                    multiline
                    autoFocus={desktop}
                    placeholder={COPY[topic].placeholder}
                    accessibilityLabel={topic === "bug" ? "What happened" : "Your note"}
                    style={{ minHeight: 160, paddingTop: 12, textAlignVertical: "top" }}
                  />
                  {text.length > BODY_MAX - 200 ? <BodySm style={{ textAlign: "right" }}>{`${BODY_MAX - text.length} left`}</BodySm> : null}
                </Field>
                {topic === "bug" ? <BodySm style={{ marginTop: 10, color: colors.ink3 }}>{contextLine(context)}</BodySm> : null}
              </>
            ) : null}

            {error ? (
              <Text accessibilityRole="alert" style={{ marginTop: 20, fontFamily: "Area-Regular", fontSize: 13.5, color: colors.oxblood }}>
                {error}
              </Text>
            ) : null}

            <ButtonBu
              title={sending ? "Sending" : "Send it in"}
              icon={sending ? <ActivityIndicator color={colors.ink} /> : undefined}
              disabled={!valid}
              accessibilityRole="button"
              accessibilityLabel="Send it in"
              accessibilityState={{ disabled: !valid, busy: sending }}
              onPress={send}
              style={{ marginTop: 24, opacity: valid || sending ? 1 : 0.45 }}
            />
            <BodySm style={{ marginTop: 12, color: colors.ink3 }}>
              {topic === "shop" ? "Two people saying closed takes it off the map until we check." : "You'll see where it stands in What you've sent. Replies come by email."}
            </BodySm>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ROWS: { topic: Topic | "missing"; title: string; line: string }[] = [
  { topic: "missing", title: "A shop is missing", line: "Drop a pin. We check it, then it's on the map." },
  { topic: "shop", title: "Something's off with a shop", line: "Find it on the map, then tap Something off? on its card." },
  { topic: "bug", title: "Something's broken", line: "Tell us what happened. We'll attach the details." },
  { topic: "idea", title: "I have an idea", line: "What would make this better for you." },
  { topic: "contact", title: "Just saying hi", line: "Press, partnerships, or anything else." },
];

function Chooser({ column, onPick }: { column: object; onPick: (t: Topic) => void }) {
  return (
    <View style={column}>
      <View style={{ paddingTop: 20, paddingBottom: 20, gap: 6 }}>
        <D2 accessibilityRole="header">What's up?</D2>
        <Body style={{ color: colors.ink2 }}>Missing shops, wrong info, bugs, ideas. It all comes to us.</Body>
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: colors.rule }}>
        {ROWS.map((r) => (
          <Tap
            key={r.topic}
            feedback="tint"
            onPress={() => (r.topic === "missing" ? router.replace({ pathname: "/map", params: { add: "1" } }) : r.topic === "shop" ? router.replace("/map") : onPick(r.topic))}
            accessibilityRole="button"
            accessibilityLabel={`${r.title}. ${r.line}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.rule }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: "Area-Bold", fontSize: 16, letterSpacing: -0.3, color: colors.ink }}>{r.title}</Text>
              <BodySm style={{ color: colors.ink2 }}>{r.line}</BodySm>
            </View>
            <Text style={{ fontFamily: "Area-Regular", fontSize: 18, color: colors.ink3 }}>›</Text>
          </Tap>
        ))}
      </View>
    </View>
  );
}

function ReasonChip({ label, on, sent, onPress }: { label: string; on: boolean; sent: boolean; onPress: () => void }) {
  const s = chipStyleForVariant(on ? "ox" : "default");
  return (
    <Tap
      onPress={onPress}
      disabled={sent}
      accessibilityRole="radio"
      accessibilityLabel={sent ? `${label}, already sent` : label}
      accessibilityState={{ checked: on, disabled: sent }}
      hitSlop={4}
      style={{ height: 36, paddingHorizontal: 12, justifyContent: "center", borderRadius: 2, borderWidth: 1, borderColor: s.border, backgroundColor: on ? s.background : colors.card, opacity: sent ? 0.5 : 1 }}
    >
      <Text style={{ fontFamily: "AreaExtended-Bold", fontSize: 8.5, letterSpacing: 0.85, textTransform: "uppercase", color: s.text }}>{sent ? `${label} · sent` : label}</Text>
    </Tap>
  );
}
