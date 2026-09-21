import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Linking, Platform } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import type { ShopDetail, ShopReview } from "@coffeesnob/supabase";
import { Avatar, Body, BodySm, ButtonLine, ButtonOx, D1, IconBack, Label } from "../primitives";
import { NavIcon } from "../nav/nav-icon";
import { Detour } from "../detour";
import { Chip } from "../chip";
import { useAuth } from "../../context/auth";
import { useShopSaved } from "../../lib/profile/use-extras";
import { openDirections } from "../../lib/directions";
import { hoursLines } from "../../lib/shop/hours";
import { consensusLine, relativeDate, telUrl, verdictCountLabel, websiteUrl } from "../../lib/shop/format";

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/map");
}

export function Hero({ shop }: { shop: ShopDetail }) {
  return (
    <View style={{ backgroundColor: colors.oxblood, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}>
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={{ width: 44, height: 44, marginLeft: -12, alignItems: "center", justifyContent: "center" }}
      >
        <IconBack color={colors.cream} />
      </Pressable>
      <D1 accessibilityRole="header" style={{ color: colors.cream, marginTop: 28 }}>
        {shop.name}
      </D1>
      {shop.neighborhood ? <Label style={{ color: colors.sage, marginTop: 10 }}>{shop.neighborhood}</Label> : null}
    </View>
  );
}

export function Consensus({ shop }: { shop: ShopDetail }) {
  const line = consensusLine(shop);
  return (
    <View style={{ gap: 8 }}>
      <Label>{line ? verdictCountLabel(shop.logCount) : "Snob consensus"}</Label>
      {line ? (
        // Mirrors the design's consensus block: verdict word left, average right.
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flexShrink: 1, gap: 8 }}>
            <D1 style={{ color: colors.burnt, fontSize: 30, lineHeight: 32, letterSpacing: -0.96 }}>{line.word}</D1>
            <Label>Most common verdict</Label>
          </View>
          {line.average ? (
            <View style={{ alignItems: "flex-end", gap: 5 }}>
              <Text style={{ fontFamily: "AreaExtended-Black", fontSize: 30, lineHeight: 30, letterSpacing: -0.6, color: colors.ink }}>{line.average}</Text>
              <Label>Average</Label>
            </View>
          ) : null}
        </View>
      ) : (
        <Body style={{ color: colors.ink2 }}>No verdicts yet. Be the first to say if it's worth the trip.</Body>
      )}
    </View>
  );
}

export function Actions({ shopId }: { shopId: string }) {
  const { session } = useAuth();
  const { saved, failed, toggle } = useShopSaved(session?.user.id ?? null, shopId);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <ButtonOx
        title="Log a visit"
        icon={<NavIcon name="plus" size={15} color={colors.cream} />}
        style={{ flex: 1 }}
        accessibilityRole="button"
        accessibilityLabel="Log a visit"
        onPress={() => router.push({ pathname: "/log", params: { shopId } })}
      />
      <ButtonLine
        title={saved ? "Saved" : failed ? "Retry save" : "Save"}
        accessibilityRole="button"
        accessibilityLabel={saved ? "Saved, tap to remove from your saved shops" : "Save this shop"}
        onPress={session ? toggle : () => router.push("/sign-in")}
      />
      {Platform.OS === "web" && (
        <ButtonLine
          title={copied ? "Link copied" : "Share"}
          accessibilityRole="button"
          accessibilityLabel="Copy link to this shop"
          onPress={share}
        />
      )}
    </View>
  );
}

export const TABS = ["Reviews", "Hours", "About"] as const;
export type ShopTab = (typeof TABS)[number];

export function TabStrip({ tab, onChange }: { tab: ShopTab; onChange: (t: ShopTab) => void }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.rule }}>
      {TABS.map((t) => (
        <Pressable
          key={t}
          onPress={() => onChange(t)}
          accessibilityRole="tab"
          accessibilityLabel={t}
          accessibilityState={{ selected: tab === t }}
          style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: tab === t ? colors.ink : "transparent" }}
        >
          <Label style={{ color: tab === t ? colors.paper : colors.ink3 }}>{t}</Label>
        </Pressable>
      ))}
    </View>
  );
}

function ReviewRow({ review }: { review: ShopReview }) {
  const name = review.displayName || review.username;
  const when = relativeDate(review.createdAt);
  return (
    <View style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.rule2, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <Avatar name={name} size={28} />
        <Pressable
          onPress={() => router.push(`/u/${review.username}`)}
          accessibilityRole="link"
          accessibilityLabel={`${name}'s profile`}
          style={{ minHeight: 44, justifyContent: "center", flexShrink: 1 }}
        >
          <Label numberOfLines={1} style={{ color: colors.ink }}>{name}</Label>
        </Pressable>
        {when ? <Label style={{ marginLeft: "auto" }}>{when}</Label> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, paddingLeft: 37 }}>
        <Detour value={review.rating} />
        {review.drink ? <Chip label={review.drink} /> : null}
      </View>
      {review.note ? <Body style={{ paddingLeft: 37 }}>{review.note}</Body> : null}
    </View>
  );
}

export function ReviewsList({ reviews }: { reviews: ShopReview[] }) {
  if (reviews.length === 0) {
    return <Body style={{ color: colors.ink3, paddingVertical: 20 }}>Nobody's weighed in yet. Log a visit and set the standard.</Body>;
  }
  return (
    <View>
      {reviews.map((r) => (
        <ReviewRow key={r.id} review={r} />
      ))}
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.rule, borderRadius: 2, padding: 16, gap: 10 }}>
      <Label>{title}</Label>
      {children}
    </View>
  );
}

export function HoursCard({ hours }: { hours: string | null }) {
  const lines = hoursLines(hours);
  return (
    <Card title="Hours">
      {lines.length === 0 ? (
        <Body style={{ color: colors.ink2 }}>Hours aren't listed yet.</Body>
      ) : (
        <View style={{ gap: 6 }}>
          {lines.map((l) => (
            <Body key={l}>{l}</Body>
          ))}
        </View>
      )}
      <BodySm>Hours come from OpenStreetMap contributors.</BodySm>
    </Card>
  );
}

function LinkRow({ label, onPress, hint }: { label: string; onPress: () => void; hint: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={hint} style={{ minHeight: 44, justifyContent: "center" }}>
      <Body style={{ color: colors.teal, textDecorationLine: "underline" }}>{label}</Body>
    </Pressable>
  );
}

export function WhereCard({ shop }: { shop: ShopDetail }) {
  const site = shop.website ? websiteUrl(shop.website) : null;
  return (
    <Card title="Where">
      <Body>{shop.address ?? "Address unknown"}</Body>
      <ButtonLine
        title="Directions"
        accessibilityRole="button"
        accessibilityLabel={`Directions to ${shop.name}`}
        onPress={() => openDirections(shop.lat, shop.lng)}
      />
      {site && shop.website ? (
        <LinkRow label={shop.website.replace(/^https?:\/\//i, "")} hint="Open website" onPress={() => Linking.openURL(site)} />
      ) : null}
      {shop.phone ? <LinkRow label={shop.phone} hint={`Call ${shop.phone}`} onPress={() => Linking.openURL(telUrl(shop.phone as string))} /> : null}
      <BodySm>Shop details © OpenStreetMap contributors.</BodySm>
    </Card>
  );
}
