import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import type { ProfileEntry } from "@coffeesnob/supabase";
import { Body, D4, Label } from "@/components/primitives";
import { tileGround } from "@/lib/profile/profile-helpers";
import { HEATMAP_WEEKS, buildHeatmap, heatLevel, snobStatus } from "@/lib/profile/status";
import { useTopShops, useVisitDates } from "@/lib/profile/use-extras";

const LEVEL_COLOR = [colors.rule2, colors.sage, colors.burnt, colors.oxblood] as const;

function TopShopTile({ entry, index }: { entry: ProfileEntry; index: number }) {
  return (
    <Pressable
      onPress={() => router.push(`/shop/${entry.shopId}`)}
      accessibilityRole="link"
      accessibilityLabel={entry.shopName}
      style={{ width: 72, height: 88, backgroundColor: tileGround(index), borderRadius: 2, padding: 7, justifyContent: "flex-end" }}
    >
      <Label numberOfLines={3} style={{ color: colors.cream, fontSize: 8, lineHeight: 11 }}>
        {entry.shopName}
      </Label>
    </Pressable>
  );
}

// The right half of the status row — a Letterboxd-style horizontal strip of a
// person's best-rated logged shops, so that space isn't just empty next to the
// (fixed-width) heatmap. Scrolls rather than wraps, so it holds up at any width.
function TopShopsRow({ userId }: { userId: string }) {
  const top = useTopShops(userId, 6);
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
      <Label>Top shops</Label>
      {top.data && top.data.length === 0 ? (
        <Body style={{ color: colors.ink3, fontSize: 12.5 }}>No favorites yet.</Body>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ opacity: top.data ? 1 : 0.4 }}>
          {(top.data ?? []).map((e, i) => (
            <TopShopTile key={e.id} entry={e} index={i} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// Snob status (derived from the entry count) + the last 12 weeks of visits,
// alongside a Top shops showcase so the row doesn't leave the right side bare.
export function StatusBlock({ userId, entries }: { userId: string; entries: number }) {
  const status = snobStatus(entries);
  const visits = useVisitDates(userId);
  const grid = buildHeatmap(visits.data ?? [], new Date());

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 22, gap: 12 }}>
      <Label>Snob status</Label>
      <View style={{ flexDirection: "row", gap: 20, alignItems: "flex-start" }}>
        <View style={{ gap: 12 }}>
          <View style={{ gap: 4 }}>
            <D4 style={{ color: colors.oxblood }}>{status.name}</D4>
            <Body style={{ color: colors.ink2 }}>
              {status.next ? `${status.next.needed} more ${status.next.needed === 1 ? "visit" : "visits"} to ${status.next.name}.` : "Top of the ladder."}
            </Body>
          </View>
          <View
            accessible
            accessibilityLabel={`Visits over the last ${HEATMAP_WEEKS} weeks`}
            style={{ flexDirection: "row", gap: 3, opacity: visits.status === "ready" ? 1 : 0.4 }}
          >
            {grid.map((week, w) => (
              <View key={w} style={{ gap: 3 }}>
                {week.map((count, d) => (
                  <View
                    key={d}
                    style={{ width: 14, height: 14, borderRadius: 2, backgroundColor: count === null ? "transparent" : LEVEL_COLOR[heatLevel(count)] }}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
        <TopShopsRow userId={userId} />
      </View>
    </View>
  );
}
