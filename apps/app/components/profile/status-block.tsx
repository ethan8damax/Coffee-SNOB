import { View } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { Body, D4, Label } from "@/components/primitives";
import { HEATMAP_WEEKS, buildHeatmap, heatLevel, snobStatus } from "@/lib/profile/status";
import { useVisitDates } from "@/lib/profile/use-extras";

const LEVEL_COLOR = [colors.rule2, colors.sage, colors.burnt, colors.oxblood] as const;

// Snob status (derived from the entry count) + the last 12 weeks of visits.
export function StatusBlock({ userId, entries }: { userId: string; entries: number }) {
  const status = snobStatus(entries);
  const visits = useVisitDates(userId);
  const grid = buildHeatmap(visits.data ?? [], new Date());

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 22, gap: 12 }}>
      <Label>Snob status</Label>
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
  );
}
