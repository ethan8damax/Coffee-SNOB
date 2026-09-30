import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Tap } from "@/components/tap";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { Body, BodySm, ButtonOx, D2, IconBack, Label } from "@/components/primitives";
import { Chip } from "@/components/chip";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { useAuth } from "@/context/auth";
import { useSent } from "@/lib/tell-us/use-sent";
import { sentCounts, sentRows, type SentRow } from "@/lib/tell-us/sent";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const addShop = () => router.push({ pathname: "/map", params: { add: "1" } });

// Everything you've told us (shops, shop reports, bugs, ideas, messages) and where each one stands.
export default function SentScreen() {
  const { session } = useAuth();
  if (!session) return <SignInPrompt message="Sign in to see what you've sent." />;
  return <Sent userId={session.user.id} />;
}

function Sent({ userId }: { userId: string }) {
  const sent = useSent(userId);
  const shops = sent.data?.shops ?? [];
  const rows = sent.data ? sentRows(sent.data.shops, sent.data.reports, sent.data.messages) : [];
  const counts = sentCounts(shops, rows);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/profile"));
  const headline =
    counts.onMap > 0 ? (counts.onMap === 1 ? "1 shop on the map because of you." : `${counts.onMap} shops on the map because of you.`) : "What you've told us.";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ alignItems: "center", paddingBottom: 48 }}>
      <View style={{ width: "100%", maxWidth: 640 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
          <Tap onPress={back} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 44, height: 44, marginLeft: -12, alignItems: "center", justifyContent: "center" }}>
            <IconBack />
          </Tap>
          <Label style={{ color: colors.ink2 }}>What you've sent</Label>
          <D2 accessibilityRole="header">{headline}</D2>
        </View>

        <View style={{ flexDirection: "row", marginTop: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.rule }}>
          <Count value={counts.onMap} label="On the map" />
          <Count value={counts.fixed} label="Fixed" />
          <Count value={counts.waiting} label="Waiting" last />
        </View>

        {sent.status === "loading" && !sent.data ? (
          <ActivityIndicator color={colors.ink3} style={{ marginTop: 32 }} />
        ) : sent.status === "error" ? (
          <View style={{ padding: 16, gap: 8 }}>
            <Body style={{ color: colors.ink2 }}>Couldn't load what you've sent.</Body>
            <Tap onPress={sent.retry} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
              <Label style={{ color: colors.oxblood }}>Try again</Label>
            </Tap>
          </View>
        ) : rows.length === 0 ? (
          <View style={{ padding: 16, paddingTop: 28, gap: 14, alignItems: "flex-start" }}>
            <Body style={{ color: colors.ink2 }}>
              Nothing yet. Shops you add, problems you flag, and notes you send all land here, with where each one stands.
            </Body>
            <ButtonOx title="Add a shop" accessibilityRole="button" onPress={addShop} />
          </View>
        ) : (
          <View>
            {rows.map((r) => (
              <Row key={r.key} r={r} />
            ))}
          </View>
        )}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20, paddingHorizontal: 16, paddingTop: 16 }}>
          <Tap onPress={addShop} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
            <Label style={{ color: colors.oxblood }}>+ Add a shop</Label>
          </Tap>
          <Tap onPress={() => router.push({ pathname: "/tell-us", params: { from: "/sent" } })} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
            <Label style={{ color: colors.oxblood }}>Tell us something</Label>
          </Tap>
        </View>
      </View>
    </ScrollView>
  );
}

function Count({ value, label, last }: { value: number; label: string; last?: boolean }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={{ flex: 1, paddingVertical: 12, alignItems: "center", gap: 4, borderRightWidth: last ? 0 : 1, borderRightColor: colors.rule }}>
      <Text style={{ fontFamily: "AreaExtended-Black", fontSize: 22, letterSpacing: -0.4, color: colors.ink }}>{value}</Text>
      <Label>{label}</Label>
    </View>
  );
}

function Row({ r }: { r: SentRow }) {
  const open = r.shopId && r.good ? () => router.push(`/shop/${r.shopId}`) : undefined;
  const body = (
    <>
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={1} style={{ fontFamily: "Area-Bold", fontSize: 16, letterSpacing: -0.3, color: colors.ink }}>
          {r.title}
        </Text>
        <BodySm style={{ color: colors.ink3 }}>{`${r.type} · ${day(r.createdAt)}`}</BodySm>
        {r.reason ? <BodySm style={{ color: colors.ink2 }}>{r.reason}</BodySm> : null}
      </View>
      <Chip label={r.status} variant={r.good ? "on" : "default"} />
    </>
  );
  const style = { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.rule2 } as const;
  return open ? (
    <Tap feedback="tint" onPress={open} accessibilityRole="link" accessibilityLabel={`${r.title}, ${r.type}, ${r.status}. Open the shop.`} style={style}>
      {body}
    </Tap>
  ) : (
    <View accessible accessibilityLabel={`${r.title}, ${r.type}, ${r.status}${r.reason ? `. ${r.reason}` : ""}`} style={style}>
      {body}
    </View>
  );
}
