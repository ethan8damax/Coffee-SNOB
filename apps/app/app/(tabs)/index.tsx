import { useState, useEffect } from "react";
import { View, FlatList, Pressable, ActivityIndicator } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { useAuth } from "@/context/auth";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { EmptyState } from "@/components/empty-state";
import { Label } from "@/components/primitives";
import { LogCard } from "@/components/feed/log-card";
import { GuideCard } from "@/components/feed/guide-card";
import { CollectionCard } from "@/components/feed/collection-card";
import { useFollowingFeed } from "@/lib/feed/use-following-feed";
import { useNearbyFeed } from "@/lib/feed/use-nearby-feed";
import { useGuidesFeed } from "@/lib/feed/use-guides-feed";
import { useUserLocation } from "@/lib/map/use-user-location";
import { boundsAround } from "@/lib/map/bounds";
import type { FeedItem } from "@/lib/feed/types";

const TABS = ["Following", "Nearby", "Guides"] as const;
type Tab = (typeof TABS)[number];

const EMPTY_MESSAGE: Record<Tab, string> = {
  Following: "Nobody you follow has logged a visit yet.",
  Nearby: "Nothing logged nearby yet.",
  Guides: "No live guides yet.",
};

// Used only when the visitor's real location can't be resolved (denied,
// unavailable, or timed out) — see useUserLocation. Mirrors the same
// fallback in apps/app/app/(tabs)/map.tsx.
const LISBON_FALLBACK = { lat: 38.71, lng: -9.14 };

function renderItem(item: FeedItem, userId: string) {
  if (item.type === "log") return <LogCard item={item} userId={userId} />;
  if (item.type === "guide") return <GuideCard item={item} />;
  return <CollectionCard item={item} />;
}

export default function HomeScreen() {
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>("Following");
  const { center: userCenter, loading: locationLoading } = useUserLocation();
  const center = userCenter ?? LISBON_FALLBACK;
  const [bounds, setBounds] = useState<ReturnType<typeof boundsAround> | null>(null);

  useEffect(() => {
    if (!locationLoading && !bounds) setBounds(boundsAround(center, 0.03));
  }, [locationLoading, bounds, center]);

  const following = useFollowingFeed(session?.user.id ?? null);
  const nearby = useNearbyFeed(bounds, session?.user.id ?? null);
  const guides = useGuidesFeed();

  if (!session) return <SignInPrompt message="Sign in to see what's near you." />;

  const active = tab === "Following" ? following : tab === "Nearby" ? nearby : guides;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={{ flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.rule }}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, paddingVertical: 11, alignItems: "center", backgroundColor: tab === t ? colors.ink : "transparent" }}>
            <Label style={{ color: tab === t ? colors.paper : colors.ink3 }}>{t}</Label>
          </Pressable>
        ))}
      </View>

      {active.loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.oxblood} />
        </View>
      ) : active.items.length === 0 ? (
        <EmptyState message={EMPTY_MESSAGE[tab]} />
      ) : (
        <FlatList data={active.items} keyExtractor={(item) => `${item.type}-${item.id}`} renderItem={({ item }) => renderItem(item, session.user.id)} />
      )}
    </View>
  );
}
