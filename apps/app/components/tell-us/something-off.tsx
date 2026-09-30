import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { Tap } from "@/components/tap";
import { Label } from "../primitives";
import type { ShopRef } from "./tell-us-form";

// "Something off?" wherever a shop shows: opens Tell us with the shop filled in.
export function SomethingOff({ shop, from }: { shop: ShopRef; from: string }) {
  const open = () =>
    router.push({
      pathname: "/tell-us",
      params: {
        about: "shop",
        ...(shop.shopId ? { shopId: shop.shopId } : { placeId: shop.placeId }),
        name: shop.name,
        lat: String(shop.lat),
        lng: String(shop.lng),
        from,
      },
    });
  return (
    <Tap onPress={open} accessibilityRole="button" accessibilityLabel={`Something off with ${shop.name}? Tell us`} hitSlop={6} style={{ minHeight: 32, justifyContent: "center", alignSelf: "flex-start" }}>
      <Label style={{ color: colors.ink3, textDecorationLine: "underline" }}>Something off?</Label>
    </Tap>
  );
}
