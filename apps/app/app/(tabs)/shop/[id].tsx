import { View, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { Body, ButtonLine, ButtonOx } from "@/components/primitives";
import { ShopView } from "@/components/shop/shop-view";
import { useShop } from "@/lib/shop/use-shop";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16, backgroundColor: colors.paper }}>
      {children}
    </View>
  );
}

// Public route: signed-out visitors can view a shop.
export default function ShopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, retry } = useShop(id);

  if (state.status === "loading") {
    return (
      <Centered>
        <ActivityIndicator color={colors.ink3} accessibilityLabel="Loading shop" />
      </Centered>
    );
  }
  if (state.status === "error") {
    return (
      <Centered>
        <Body style={{ textAlign: "center", color: colors.ink3, maxWidth: 260 }}>Couldn't load this shop. Check your connection and try again.</Body>
        <ButtonOx title="Try again" onPress={retry} accessibilityRole="button" accessibilityLabel="Try again" />
      </Centered>
    );
  }
  if (state.status === "notfound") {
    return (
      <Centered>
        <Body style={{ textAlign: "center", color: colors.ink3, maxWidth: 260 }}>
          This shop doesn't have a page yet. Shops get one after their first logged visit.
        </Body>
        <ButtonLine title="Back to the map" onPress={() => router.replace("/map")} accessibilityRole="button" accessibilityLabel="Back to the map" />
      </Centered>
    );
  }
  return <ShopView shop={state.shop} reviews={state.reviews} />;
}
