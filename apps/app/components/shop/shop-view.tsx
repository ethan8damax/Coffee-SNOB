import { useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import type { ShopDetail, ShopHeader, ShopPhoto, ShopReview } from "@coffeesnob/supabase";
import { Gallery } from "../photos/gallery";
import { isDesktopWidth } from "@/lib/nav";
import { SomethingOff } from "../tell-us/something-off";
import { Actions, Consensus, Hero, HoursCard, ReviewsList, TabStrip, WhereCard, type ShopTab } from "./parts";

export function ShopView({ shop, reviews, header, photos }: { shop: ShopDetail; reviews: ShopReview[]; header: ShopHeader | null; photos: ShopPhoto[] }) {
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<ShopTab>("Reviews");
  const ref = { shopId: shop.id, name: shop.name, lat: shop.lat, lng: shop.lng };

  if (isDesktopWidth(width)) {
    // WideShop: hero across the top, main column + 340px side column.
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ flexGrow: 1 }}>
        <Hero shop={shop} header={header} />
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 32, padding: 32, width: "100%", maxWidth: 1120, alignSelf: "center" }}>
          <View style={{ flex: 1, minWidth: 0, gap: 24 }}>
            <Consensus shop={shop} />
            <Actions shopId={shop.id} name={shop.name} />
            <Gallery photos={photos} />
            <ReviewsList reviews={reviews} />
          </View>
          <View style={{ width: 340, gap: 16 }}>
            <HoursCard hours={shop.hours} />
            <WhereCard shop={shop} />
            <SomethingOff shop={ref} from={`/shop/${shop.id}`} />
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ flexGrow: 1 }}>
      <Hero shop={shop} header={header} />
      <View style={{ padding: 16, gap: 18 }}>
        <Consensus shop={shop} />
        <Actions shopId={shop.id} name={shop.name} />
        <Gallery photos={photos} />
      </View>
      <TabStrip tab={tab} onChange={setTab} />
      <View style={{ padding: 16 }}>
        {tab === "Reviews" && <ReviewsList reviews={reviews} />}
        {tab === "Hours" && <HoursCard hours={shop.hours} />}
        {tab === "About" && <WhereCard shop={shop} />}
      </View>
      <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <SomethingOff shop={ref} from={`/shop/${shop.id}`} />
      </View>
    </ScrollView>
  );
}
