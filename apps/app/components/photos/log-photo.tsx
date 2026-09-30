import { useSyncExternalStore } from "react";
import { Image, View } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { photoUrl, type LogPhoto as Photo } from "@coffeesnob/supabase";
import { isPending, previewFor, subscribe } from "@/lib/photos/pending";
import { Label } from "../primitives";

const PHOTOS_URL = process.env.EXPO_PUBLIC_PHOTOS_URL ?? "";

// A log's photo on a card. Your own entry shows the picked image while it
// uploads (and until the next load brings the stored one).
export function LogPhoto({ photo, logId, mine }: { photo: Photo | null; logId: string; mine: boolean }) {
  const pending = useSyncExternalStore(subscribe, () => mine && isPending(logId));
  const preview = mine && !photo ? previewFor(logId) : null;
  const uri = photo ? photoUrl(PHOTOS_URL, photo.thumbPath) : preview;
  if (!uri) return null;
  // Wide photos keep their shape; tall ones crop to 4:3 so cards stay tight.
  const aspectRatio = photo ? Math.max(photo.width / photo.height, 4 / 3) : 4 / 3;
  return (
    <View style={{ gap: 6 }}>
      <Image source={{ uri }} accessibilityLabel="Photo from this visit" resizeMode="cover" style={{ width: "100%", aspectRatio, borderRadius: 2, backgroundColor: colors.paper2 }} />
      {pending ? <Label style={{ color: colors.ink3 }}>Photo pending</Label> : null}
    </View>
  );
}
