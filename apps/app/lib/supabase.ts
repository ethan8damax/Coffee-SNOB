import "react-native-url-polyfill/auto";
import { createSupabaseClient } from "@coffeesnob/supabase";

export const supabase = createSupabaseClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);
