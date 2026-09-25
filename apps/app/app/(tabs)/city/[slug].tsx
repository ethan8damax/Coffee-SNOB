import { ActivityIndicator, FlatList, View, useWindowDimensions } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { Body, BodySm, ButtonOx, D2, Label } from "@/components/primitives";
import { ShopRow } from "@/components/map/shop-row";
import { useCity } from "@/lib/city/use-city";
import { isDesktopWidth } from "@/lib/nav";

// Every rated shop in a city, best verdict first. A shop joins the moment it's
// first rated; curated "best in city" guides come later, built on top of this.
// No page for a city with zero rated shops — it redirects to the map instead.
export default function CityScreen() {
  const { slug, name } = useLocalSearchParams<{ slug: string; name?: string }>();
  const { width } = useWindowDimensions();
  const wide = isDesktopWidth(width);
  const { state, retry } = useCity(slug);

  const title = (state.status === "ready" && state.locality) || name || "This city";

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper }}>
        <ActivityIndicator color={colors.ink3} accessibilityLabel="Loading city" />
      </View>
    );
  }
  if (state.status === "error") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24, backgroundColor: colors.paper }}>
        <Body style={{ textAlign: "center", color: colors.ink3 }}>Couldn't load this city. Check your connection and try again.</Body>
        <ButtonOx title="Try again" onPress={retry} accessibilityRole="button" accessibilityLabel="Try again" />
      </View>
    );
  }

  if (state.shops.length === 0) return <Redirect href="/map" />;

  const count = state.shops.length;
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ width: "100%", maxWidth: 720, alignSelf: "center", paddingBottom: 32 }}
      data={state.shops}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => (
        <ShopRow row={{ kind: "rated", shop: item, distanceKm: null }} active={false} wide={wide} onPress={() => router.push(`/shop/${item.id}`)} />
      )}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, gap: 6, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
          <Label>City</Label>
          <D2 accessibilityRole="header">{title}</D2>
          <BodySm>{`${count} rated ${count === 1 ? "shop" : "shops"}, best verdict first`}</BodySm>
        </View>
      }
    />
  );
}
