import { View, FlatList, ActivityIndicator } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import type { ListRow } from "../../lib/map/shop-list";
import type { NearbyStatus } from "../../lib/map/nearby-map-data";
import { Body, BodySm, ButtonLine } from "../primitives";
import { ShopRow, rowKey } from "./shop-row";

function Notice({ children }: { children: string }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.paper2, borderBottomWidth: 1, borderBottomColor: colors.rule2 }}>
      <BodySm style={{ color: colors.ink2 }}>{children}</BodySm>
    </View>
  );
}

function EmptyState({ status, onRetry }: { status: NearbyStatus; onRetry: () => void }) {
  if (status === "loading") {
    return (
      <View style={{ padding: 28, alignItems: "center", gap: 12 }}>
        <ActivityIndicator color={colors.oxblood} />
        <Body style={{ color: colors.ink3 }}>Looking for shops nearby…</Body>
      </View>
    );
  }
  if (status === "error") {
    return (
      <View style={{ padding: 28, alignItems: "center", gap: 14 }}>
        <Body style={{ color: colors.ink2, textAlign: "center" }}>We couldn't load the shops around here.</Body>
        <ButtonLine title="Try again" onPress={onRetry} accessibilityRole="button" accessibilityLabel="Try loading nearby shops again" />
      </View>
    );
  }
  return (
    <View style={{ padding: 28 }}>
      <Body style={{ color: colors.ink2, textAlign: "center" }}>No shops mapped here. Pan the map or zoom out.</Body>
    </View>
  );
}

// The list behind both the phone's bottom sheet and the desktop's side panel.
// Also carries the map's honest states: loading, error, empty, offline, and
// "location is off".
export function ShopListView({
  rows,
  activeKey,
  wide,
  status,
  offline,
  fallbackLabel,
  onPressRow,
  onRetry,
}: {
  rows: ListRow[];
  activeKey: string | null;
  wide: boolean;
  status: NearbyStatus;
  offline: boolean;
  // Set when the map opened on the fallback area because location isn't available.
  fallbackLabel: string | null;
  onPressRow: (row: ListRow) => void;
  onRetry: () => void;
}) {
  const notices: string[] = [];
  if (offline) notices.push("You're offline. Showing what's already loaded.");
  if (fallbackLabel) notices.push(`Location is off, so this is ${fallbackLabel}. Allow location in your browser to see shops near you.`);
  if (status === "error" && rows.length > 0) notices.push("Some nearby shops didn't load. Pan the map to try again.");

  return (
    <FlatList
      data={rows}
      keyExtractor={rowKey}
      renderItem={({ item }) => <ShopRow row={item} active={rowKey(item) === activeKey} wide={wide} onPress={() => onPressRow(item)} />}
      ListHeaderComponent={notices.length ? <View>{notices.map((n) => <Notice key={n}>{n}</Notice>)}</View> : null}
      ListEmptyComponent={<EmptyState status={status} onRetry={onRetry} />}
      initialNumToRender={12}
      windowSize={7}
      keyboardShouldPersistTaps="handled"
    />
  );
}
