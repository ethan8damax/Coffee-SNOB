import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, TextInput, View, useWindowDimensions } from "react-native";
import { Tap } from "@/components/tap";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { clearTopShop, getProfileEntries, setTopShop, type TopShop } from "@coffeesnob/supabase";
import { supabase } from "@/lib/supabase";
import { isDesktopWidth } from "@/lib/nav";
import { tileGround } from "@/lib/profile/profile-helpers";
import { topFourSlots } from "@/lib/collections/top4";
import { useTopFour } from "@/lib/collections/use-collections";
import { Body, BodySm, ButtonLine, D4, Label } from "../primitives";

const TILE = { width: 72, height: 88, borderRadius: 2 } as const;

function Sheet({ onClose, children, title }: { onClose: () => void; children: React.ReactNode; title: string }) {
  const { width } = useWindowDimensions();
  const desktop = isDesktopWidth(width);
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Tap
        feedback="none"
        onPress={onClose}
        accessibilityLabel="Close"
        style={{ flex: 1, backgroundColor: "rgba(26,20,16,0.45)", justifyContent: desktop ? "center" : "flex-end", alignItems: "center" }}
      >
        <Tap
          feedback="none"
          onPress={() => {}}
          accessible={false}
          style={{ width: desktop ? 420 : "100%", maxHeight: "80%", backgroundColor: colors.paper, borderTopWidth: 2, borderColor: colors.ink, borderWidth: desktop ? 2 : 0, borderRadius: 2, padding: 20, gap: 14 }}
        >
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <D4 accessibilityRole="header">{title}</D4>
            <Tap onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
              <Label style={{ color: colors.ink }}>Close</Label>
            </Tap>
          </View>
          {children}
        </Tap>
      </Tap>
    </Modal>
  );
}

// A favourite should be somewhere you've been: the picker lists shops you've logged.
function Picker({ userId, slot, onPicked, onClose }: { userId: string; slot: number; onPicked: () => void; onClose: () => void }) {
  const [shops, setShops] = useState<{ shopId: string; name: string; area: string | null }[] | null>(null);
  const [query, setQuery] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    getProfileEntries(supabase, userId, { limit: 200 }).then(
      (entries) => {
        const seen = new Map<string, { shopId: string; name: string; area: string | null }>();
        for (const e of entries) if (!seen.has(e.shopId)) seen.set(e.shopId, { shopId: e.shopId, name: e.shopName, area: e.shopNeighborhood });
        setShops([...seen.values()]);
      },
      () => setFailed(true),
    );
  }, [userId]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (shops ?? []).filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [shops, query]);

  const pick = async (shopId: string) => {
    try {
      await setTopShop(supabase, userId, slot, shopId);
      onPicked();
    } catch {
      setFailed(true);
    }
  };

  return (
    <Sheet onClose={onClose} title={`Favourite #${slot}`}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search shops you've logged"
        placeholderTextColor={colors.ink3}
        accessibilityLabel="Search shops you've logged"
        style={{ height: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.rule, borderRadius: 2, backgroundColor: colors.card, fontFamily: "Area-Regular", fontSize: 14, color: colors.ink }}
      />
      {!shops && !failed ? <ActivityIndicator color={colors.oxblood} style={{ padding: 16 }} /> : null}
      {shops && shops.length === 0 ? <Body style={{ color: colors.ink3 }}>{"Log a visit first. Your favourites come from places you've been."}</Body> : null}
      <ScrollView style={{ maxHeight: 320 }}>
        {shown.map((s) => (
          <Tap
            feedback="tint"
            key={s.shopId}
            onPress={() => pick(s.shopId)}
            accessibilityRole="button"
            accessibilityLabel={`Make ${s.name} favourite number ${slot}`}
            style={{ minHeight: 52, justifyContent: "center", gap: 3, borderBottomWidth: 1, borderBottomColor: colors.rule2, paddingVertical: 8 }}
          >
            <Body style={{ fontFamily: "Area-Bold", color: colors.ink }}>{s.name}</Body>
            {s.area ? <Label>{s.area}</Label> : null}
          </Tap>
        ))}
      </ScrollView>
      {failed ? <BodySm style={{ color: colors.oxblood }}>{"Couldn't save that. Try again."}</BodySm> : null}
    </Sheet>
  );
}

// Letterboxd-style Top 4, picked by hand, never filled automatically.
// Owners see all four slots (empty ones as "+"); visitors see only picks.
export function TopFour({ userId, isOwn }: { userId: string; isOwn: boolean }) {
  const top = useTopFour(userId);
  const [picking, setPicking] = useState<number | null>(null);
  const [menu, setMenu] = useState<TopShop | null>(null);
  const slots = topFourSlots(top.data ?? [], isOwn);
  if (!isOwn && top.data && slots.length === 0) return null;

  return (
    <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
      <Label>Top 4</Label>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", opacity: top.data ? 1 : 0.4 }}>
        {slots.map(({ slot, pick }, i) =>
          pick ? (
            <Tap
              key={slot}
              onPress={() => (isOwn ? setMenu(pick) : router.push(`/shop/${pick.shopId}`))}
              accessibilityRole={isOwn ? "button" : "link"}
              accessibilityLabel={isOwn ? `Favourite #${slot}: ${pick.name}. Change it` : pick.name}
              style={{ ...TILE, backgroundColor: tileGround(i), padding: 7, justifyContent: "flex-end" }}
            >
              <Label numberOfLines={3} style={{ color: colors.cream, fontSize: 8, lineHeight: 11 }}>
                {pick.name}
              </Label>
            </Tap>
          ) : (
            <Tap
              key={slot}
              onPress={() => setPicking(slot)}
              accessibilityRole="button"
              accessibilityLabel={`Pick a favourite shop for slot ${slot}`}
              style={{ ...TILE, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.rule, alignItems: "center", justifyContent: "center" }}
            >
              <Label style={{ fontSize: 20, lineHeight: 22, color: colors.ink3 }}>+</Label>
            </Tap>
          ),
        )}
      </View>

      {picking !== null ? (
        <Picker
          userId={userId}
          slot={picking}
          onClose={() => setPicking(null)}
          onPicked={() => {
            setPicking(null);
            top.retry();
          }}
        />
      ) : null}

      {menu ? (
        <Sheet onClose={() => setMenu(null)} title={menu.name}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <ButtonLine
              title="Replace"
              onPress={() => {
                setMenu(null);
                setPicking(menu.slot);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Replace ${menu.name}`}
              style={{ flex: 1 }}
            />
            <ButtonLine
              title="Remove"
              onPress={async () => {
                setMenu(null);
                await clearTopShop(supabase, userId, menu.slot).catch(() => {});
                top.retry();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${menu.name} from your Top 4`}
              style={{ flex: 1 }}
            />
          </View>
          <Tap onPress={() => router.push(`/shop/${menu.shopId}`)} accessibilityRole="link" hitSlop={8}>
            <Label style={{ color: colors.oxblood }}>Open the shop</Label>
          </Tap>
        </Sheet>
      ) : null}
    </View>
  );
}
