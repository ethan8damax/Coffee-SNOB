import { Image, Linking, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors } from "@coffeesnob/design-tokens";
import { Tap } from "@/components/tap";
import type { PickedPhoto } from "@/lib/photos/queue-log-photo";
import { BodySm, ButtonLine, Label } from "../primitives";

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? "";

// One photo per entry (photos spec). Compression and upload happen after publish.
export function PhotoField({ value, onChange }: { value: PickedPhoto | null; onChange: (p: PickedPhoto | null) => void }) {
  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: false, quality: 1, exif: false });
    const asset = res.canceled ? null : res.assets[0];
    if (asset) onChange({ uri: asset.uri, width: asset.width, height: asset.height });
  }

  return (
    <View style={{ gap: 12, marginTop: 28 }}>
      <Label>A photo</Label>
      {value ? (
        <View style={{ gap: 8 }}>
          <Image
            source={{ uri: value.uri }}
            accessibilityLabel="Your photo"
            style={{ width: "100%", aspectRatio: Math.max(value.width / value.height, 4 / 3), borderRadius: 2, backgroundColor: colors.paper2 }}
            resizeMode="cover"
          />
          <Tap onPress={() => onChange(null)} accessibilityRole="button" accessibilityLabel="Remove photo" hitSlop={8} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
            <Label style={{ color: colors.oxblood }}>Remove</Label>
          </Tap>
        </View>
      ) : (
        <ButtonLine title="Add a photo" accessibilityRole="button" accessibilityLabel="Add a photo" onPress={pick} />
      )}
      <BodySm>
        Only add photos you took.{" "}
        <BodySm accessibilityRole="link" onPress={() => Linking.openURL(`${WEB_APP_URL}/terms`)} style={{ color: colors.teal, textDecorationLine: "underline" }}>
          Photo terms
        </BodySm>
      </BodySm>
    </View>
  );
}
