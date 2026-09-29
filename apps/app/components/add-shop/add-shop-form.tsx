import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, Text, TextInput, View, useWindowDimensions, type TextInputProps } from "react-native";
import { Tap } from "@/components/tap";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { submitShop } from "@coffeesnob/supabase";
import { supabase } from "@/lib/supabase";
import { isDesktopWidth } from "@/lib/nav";
import { Body, BodySm, ButtonBu, ButtonOx, D2, Label } from "../primitives";
import { HoursEditor } from "./hours-editor";
import { emptyWeek, formatHours, toWebsite } from "../../lib/add-shop/form";
import { locateShop, type ShopLocation } from "../../lib/log/locate";

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? "";
const NOTE_MAX = 500;

const leave = () => (router.canGoBack() ? router.back() : router.replace("/map"));
const movePin = (name: string) => router.replace({ pathname: "/map", params: { add: name || "1" } });

function errorMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? "");
  if (/chain/i.test(m)) return "Chains can't be added.";
  if (/10 shops/i.test(m)) return "That's 10 shops today. Send more tomorrow.";
  if (/suspended/i.test(m)) return "Your account can't add shops right now.";
  return "Couldn't send it. Give it another go.";
}

export function AddShopForm({ initialName, lat, lng }: { initialName: string; lat: number; lng: number }) {
  const { width } = useWindowDimensions();
  const desktop = isDesktopWidth(width);
  const [name, setName] = useState(initialName);
  const [place, setPlace] = useState<ShopLocation | null>(null);
  const [address, setAddress] = useState("");
  const [showHours, setShowHours] = useState(false);
  const [week, setWeek] = useState(emptyWeek);
  const [site, setSite] = useState("");
  const [roaster, setRoaster] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ shopId: string | null } | null>(null);
  const inFlight = useRef(false);
  const addressTouched = useRef(false);

  // Where the pin is: street address to prefill, city for the shop's city page.
  useEffect(() => {
    let cancelled = false;
    locateShop(lat, lng, WEB_APP_URL, true).then((p) => {
      if (cancelled) return;
      setPlace(p);
      if (p.address && !addressTouched.current) setAddress(p.address);
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  const website = toWebsite(site);
  const siteBad = site.trim() !== "" && !website;
  const valid = name.trim().length >= 2 && !siteBad && !sending;
  const where = [place?.locality, place?.region].filter(Boolean).join(", ");

  async function send() {
    if (!valid || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError(null);
    try {
      const result = await submitShop(supabase, {
        name,
        lat,
        lng,
        address,
        hours: showHours ? formatHours(week) : null,
        website,
        roaster,
        note,
        locality: place?.locality,
        region: place?.region,
        countryCode: place?.countryCode,
      });
      setDone({ shopId: result.shopId });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  if (done) {
    const live = done.shopId !== null;
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14, backgroundColor: colors.paper }}>
        <Label style={{ color: colors.oxblood }}>{live ? "On the map" : "Sent"}</Label>
        <D2 accessibilityRole="header" style={{ textAlign: "center", maxWidth: 420 }}>
          {live ? `${name.trim()} is on the map.` : `${name.trim()} is in the queue.`}
        </D2>
        <Body style={{ textAlign: "center", color: colors.ink2, maxWidth: 320 }}>
          {live ? "Admin adds skip the queue." : "We check every shop before it goes on the map. You'll hear from us at the top of your feed."}
        </Body>
        {live ? (
          <ButtonOx title="Open the shop" accessibilityRole="button" onPress={() => router.replace(`/shop/${done.shopId}`)} style={{ marginTop: 8, minWidth: 240 }} />
        ) : (
          <ButtonOx title="Back to the map" accessibilityRole="button" onPress={() => router.replace("/map")} style={{ marginTop: 8, minWidth: 240 }} />
        )}
        <Tap onPress={() => movePin("")} accessibilityRole="button" accessibilityLabel="Add another shop" hitSlop={8} style={{ minHeight: 44, justifyContent: "center" }}>
          <Label style={{ color: colors.ink2 }}>Add another</Label>
        </Tap>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, alignItems: desktop ? "center" : "stretch" }}>
        <View style={{ width: "100%", maxWidth: desktop ? 560 : undefined, paddingHorizontal: 16, paddingBottom: 40 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52 }}>
            <Tap onPress={leave} accessibilityRole="button" accessibilityLabel="Cancel" style={{ minHeight: 44, minWidth: 64, justifyContent: "center" }}>
              <Label style={{ color: colors.ink2 }}>Cancel</Label>
            </Tap>
            <Label style={{ color: colors.ink }}>Add a shop</Label>
            <Tap
              onPress={send}
              disabled={!valid}
              accessibilityRole="button"
              accessibilityLabel="Send"
              accessibilityState={{ disabled: !valid }}
              style={{ minHeight: 44, minWidth: 64, justifyContent: "center", alignItems: "flex-end" }}
            >
              <Label style={{ color: valid ? colors.burnt : colors.ink3 }}>Send</Label>
            </Tap>
          </View>

          <View style={{ paddingTop: 20, paddingBottom: 8, gap: 6 }}>
            <Label>Missing from the map</Label>
            <D2 accessibilityRole="header">{name.trim() || "New shop"}</D2>
          </View>

          <Field label="Name on the sign" required>
            <Input value={name} onChangeText={setName} maxLength={120} placeholder="Wuz Here Coffee" accessibilityLabel="Shop name" />
          </Field>

          <Field label="The pin" required>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderWidth: 1, borderColor: colors.rule, borderRadius: 2, backgroundColor: colors.card }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.oxblood, borderWidth: 2, borderColor: colors.card }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: "Area-Regular", fontSize: 14, color: colors.ink }}>{where || (place ? "Pin placed" : "Finding the spot…")}</Text>
                <BodySm style={{ color: colors.ink3 }}>{`${lat.toFixed(5)}, ${lng.toFixed(5)}`}</BodySm>
              </View>
              <Tap onPress={() => movePin(name.trim())} accessibilityRole="button" accessibilityLabel="Move the pin" hitSlop={8} style={{ minHeight: 44, justifyContent: "center" }}>
                <Label style={{ color: colors.oxblood }}>Move</Label>
              </Tap>
            </View>
          </Field>

          <View style={{ marginTop: 32, marginBottom: 4, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Label style={{ color: colors.ink3 }}>If you know it</Label>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.rule }} />
          </View>

          <Field label="Address">
            <Input
              value={address}
              onChangeText={(v) => {
                addressTouched.current = true;
                setAddress(v);
              }}
              maxLength={300}
              placeholder="Street address"
              accessibilityLabel="Address"
            />
          </Field>

          <Field label="Hours">
            {showHours ? (
              <HoursEditor value={week} onChange={setWeek} />
            ) : (
              <Tap
                onPress={() => setShowHours(true)}
                accessibilityRole="button"
                accessibilityLabel="Add opening hours"
                style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderStyle: "dashed", borderColor: colors.rule, borderRadius: 2 }}
              >
                <Label style={{ color: colors.ink2 }}>+ Add hours</Label>
              </Tap>
            )}
          </Field>

          <Field label="Website or Instagram" hint={siteBad ? "That doesn't look like a link. Try wuzhere.com or @wuzhere." : undefined}>
            <Input
              value={site}
              onChangeText={setSite}
              maxLength={200}
              placeholder="wuzhere.com or @wuzhere"
              accessibilityLabel="Website or Instagram"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              bad={siteBad}
            />
          </Field>

          <Field label="What they pour">
            <Input value={roaster} onChangeText={setRoaster} maxLength={120} placeholder="The roaster on the bag" accessibilityLabel="Roaster they serve" />
          </Field>

          <Field label="Anything we should know">
            <Input
              value={note}
              onChangeText={setNote}
              maxLength={NOTE_MAX}
              multiline
              placeholder="Why it belongs here. Be specific."
              accessibilityLabel="Note for the curators"
              style={{ minHeight: 96, paddingTop: 12, textAlignVertical: "top" }}
            />
            {note.length > NOTE_MAX - 100 ? <BodySm style={{ textAlign: "right" }}>{`${NOTE_MAX - note.length} left`}</BodySm> : null}
          </Field>

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
          <BodySm style={{ marginTop: 12, color: colors.ink3 }}>We check every shop before it goes on the map. Chains can't be added.</BodySm>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10, marginTop: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Label>{label}</Label>
        {required ? <Label style={{ color: colors.ink3, fontSize: 7.5 }}>Required</Label> : null}
      </View>
      {children}
      {hint ? (
        <BodySm accessibilityLiveRegion="polite" style={{ color: colors.oxblood }}>
          {hint}
        </BodySm>
      ) : null}
    </View>
  );
}

function Input({ bad, style, ...props }: TextInputProps & { bad?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={colors.ink3}
      {...props}
      style={[
        {
          minHeight: 44,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: bad ? colors.oxblood : colors.rule,
          borderRadius: 2,
          backgroundColor: colors.card,
          fontFamily: "Area-Regular",
          fontSize: 16, // 16+ stops iOS zooming on focus
          lineHeight: 20,
          color: colors.ink,
        },
        style,
      ]}
    />
  );
}
