import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import { createSupabaseClient } from "@coffeesnob/supabase";
import { LargeSecureStore } from "./large-secure-store";

export const supabase = createSupabaseClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: Platform.OS === "web" ? undefined : new LargeSecureStore(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  }
);
