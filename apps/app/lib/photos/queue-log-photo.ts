import { compressPhoto } from "./compress";
import { enqueuePhoto } from "./pending";
import { uploadLogPhoto, type CompressedPhoto } from "./upload";

export type PickedPhoto = { uri: string; width: number; height: number };

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? "";

// After the log is saved: compress once, then upload with retries. The access
// token is read on every try so a refreshed session is picked up.
export function queueLogPhoto(logId: string, picked: PickedPhoto) {
  let compressed: Promise<CompressedPhoto> | null = null;
  enqueuePhoto(
    logId,
    async () => {
      compressed ??= compressPhoto(picked.uri, picked.width, picked.height).catch((e) => {
        compressed = null;
        throw e;
      });
      const photo = await compressed;
      const { supabase } = require("../supabase");
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Signed out");
      await uploadLogPhoto({ apiBase: WEB_APP_URL, token: data.session.access_token, logId, photo });
    },
    picked.uri,
  );
}
