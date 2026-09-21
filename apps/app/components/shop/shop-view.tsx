import { useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import type { ShopDetail, ShopReview } from "@coffeesnob/supabase";
import { isDesktopWidth } from "@/lib/nav";
import { Actions, Consensus, Hero, HoursCard, ReviewsList, TabStrip, WhereCard, type ShopTab } from "./parts";

export function ShopView({ shop, reviews }: { shop: ShopDetail; reviews: ShopReview[] }) {
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<ShopTab>("Reviews");

  if (isDesktopWidth(width)) {
    // WideShop: hero across the top, main column + 340px side column.
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ flexGrow: 1 }}>
        <Hero shop={shop} />
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 32, padding: 32, width: "100%", maxWidth: 1120, alignSelf: "center" }}>
          <View style={{ flex: 1, minWidth: 0, gap: 24 }}>
            <Consensus shop={shop} />
            <Actions shopId={shop.id} />
            <ReviewsList reviews={reviews} />
          </View>
          <View style={{ width: 340, gap: 16 }}>
            <HoursCard hours={shop.hours} />
            <WhereCard shop={shop} />
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ flexGrow: 1 }}>
      <Hero shop={shop} />
      <View style={{ padding: 16, gap: 18 }}>
        <Consensus shop={shop} />
        <Actions shopId={shop.id} />
      </View>
      <TabStrip tab={tab} onChange={setTab} />
      <View style={{ padding: 16 }}>
        {tab === "Reviews" && <ReviewsList reviews={reviews} />}
        {tab === "Hours" && <HoursCard hours={shop.hours} />}
        {tab === "About" && <WhereCard shop={shop} />}
      </View>
    </ScrollView>
  );
}
