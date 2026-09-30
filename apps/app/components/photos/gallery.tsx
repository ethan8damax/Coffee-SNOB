import { useState } from "react";
import { Image, Modal, ScrollView, View, useWindowDimensions } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { photoUrl, type ShopPhoto } from "@coffeesnob/supabase";
import { Tap } from "@/components/tap";
import { Label } from "../primitives";
import { CreditTag } from "./tag";

const PHOTOS_URL = process.env.EXPO_PUBLIC_PHOTOS_URL ?? "";

// The shop's photos as a strip; tap one for the full size and its credit.
export function Gallery({ photos }: { photos: ShopPhoto[] }) {
  const [open, setOpen] = useState<ShopPhoto | null>(null);
  const { width, height } = useWindowDimensions();
  if (photos.length === 0) return null;
  return (
    <View style={{ gap: 10 }}>
      <Label>Photos</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {photos.map((p) => (
          <Tap key={p.id} onPress={() => setOpen(p)} accessibilityRole="button" accessibilityLabel={p.username ? `Photo by ${p.username}` : "Photo"}>
            <Image source={{ uri: photoUrl(PHOTOS_URL, p.thumbPath) }} style={{ width: 96, height: 96, borderRadius: 2, backgroundColor: colors.paper2 }} resizeMode="cover" />
          </Tap>
        ))}
      </ScrollView>
      <Modal visible={open !== null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Tap onPress={() => setOpen(null)} accessibilityRole="button" accessibilityLabel="Close photo" style={{ flex: 1, backgroundColor: "rgba(22,19,16,0.94)", alignItems: "center", justifyContent: "center" }}>
          {open ? (
            <View>
              <Image
                source={{ uri: photoUrl(PHOTOS_URL, open.path) }}
                style={{ width: Math.min(width - 32, (height - 120) * (open.width / open.height)), aspectRatio: open.width / open.height, backgroundColor: colors.ink }}
                resizeMode="contain"
              />
              <CreditTag username={open.username} style={{ position: "absolute", top: 10, right: 10 }} />
            </View>
          ) : null}
        </Tap>
      </Modal>
    </View>
  );
}
