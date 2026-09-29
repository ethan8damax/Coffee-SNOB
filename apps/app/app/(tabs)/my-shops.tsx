import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Tap } from "@/components/tap";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import type { ShopSubmission } from "@coffeesnob/supabase";
import { Body, BodySm, ButtonOx, D2, IconBack, Label } from "@/components/primitives";
import { Chip } from "@/components/chip";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { useAuth } from "@/context/auth";
import { useMySubmissions } from "@/lib/add-shop/use-my-submissions";
import { STATUS_LABEL, submissionCounts } from "@/lib/add-shop/summary";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const addShop = () => router.push({ pathname: "/map", params: { add: "1" } });

// Everything you've sent through Add a shop, and where each one stands.
export default function MyShopsScreen() {
  const { session } = useAuth();
  if (!session) return <SignInPrompt message="Sign in to see the shops you've added." />;
  return <MyShops userId={session.user.id} />;
}

function MyShops({ userId }: { userId: string }) {
  const mine = useMySubmissions(userId);
  const list = mine.data ?? [];
  const counts = submissionCounts(list);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/profile"));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ alignItems: "center", paddingBottom: 48 }}>
      <View style={{ width: "100%", maxWidth: 640 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
          <Tap onPress={back} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 44, height: 44, marginLeft: -12, alignItems: "center", justifyContent: "center" }}>
            <IconBack />
          </Tap>
          <Label style={{ color: colors.ink2 }}>Shops you added</Label>
          <D2 accessibilityRole="header">{counts.onMap === 1 ? "1 shop on the map because of you." : `${counts.onMap} shops on the map because of you.`}</D2>
        </View>

        <View style={{ flexDirection: "row", marginTop: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.rule }}>
          <Count value={counts.onMap} label="On the map" />
          <Count value={counts.waiting} label="Waiting" />
          <Count value={counts.passed} label="Passed" last />
        </View>

        {mine.status === "loading" && !mine.data ? (
          <ActivityIndicator color={colors.ink3} style={{ marginTop: 32 }} />
        ) : mine.status === "error" ? (
          <View style={{ padding: 16, gap: 8 }}>
            <Body style={{ color: colors.ink2 }}>Couldn't load your shops.</Body>
            <Tap onPress={mine.retry} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
              <Label style={{ color: colors.oxblood }}>Try again</Label>
            </Tap>
          </View>
        ) : list.length === 0 ? (
          <View style={{ padding: 16, paddingTop: 28, gap: 14, alignItems: "flex-start" }}>
            <Body style={{ color: colors.ink2 }}>Nothing yet. If the map is missing a shop you know, put it there.</Body>
            <ButtonOx title="Add a shop" accessibilityRole="button" onPress={addShop} />
          </View>
        ) : (
          <View>
            {list.map((s) => (
              <Row key={s.id} s={s} />
            ))}
            <Tap onPress={addShop} accessibilityRole="button" accessibilityLabel="Add another shop" style={{ minHeight: 52, justifyContent: "center", paddingHorizontal: 16 }}>
              <Label style={{ color: colors.oxblood }}>+ Add another</Label>
            </Tap>
          </View>
        )}
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

function Row({ s }: { s: ShopSubmission }) {
  const where = [s.locality, s.region].filter(Boolean).join(", ");
  const meta = [where, `sent ${day(s.createdAt)}`].filter(Boolean).join(" · ");
  const open = s.status === "approved" && s.shopId ? () => router.push(`/shop/${s.shopId}`) : undefined;
  const body = (
    <>
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={1} style={{ fontFamily: "Area-Bold", fontSize: 16, letterSpacing: -0.3, color: colors.ink }}>
          {s.name}
        </Text>
        <BodySm style={{ color: colors.ink3 }}>{meta}</BodySm>
        {s.status === "declined" && s.declineReason ? <BodySm style={{ color: colors.ink2 }}>{s.declineReason}</BodySm> : null}
      </View>
      <Chip label={STATUS_LABEL[s.status]} variant={s.status === "approved" ? "on" : "default"} />
    </>
  );
  const style = { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.rule2 } as const;
  return open ? (
    <Tap feedback="tint" onPress={open} accessibilityRole="link" accessibilityLabel={`${s.name}, on the map. Open the shop.`} style={style}>
      {body}
    </Tap>
  ) : (
    <View accessible accessibilityLabel={`${s.name}, ${STATUS_LABEL[s.status]}`} style={style}>
      {body}
    </View>
  );
}
