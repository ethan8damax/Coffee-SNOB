import { Dimensions, Platform } from "react-native";
import Constants from "expo-constants";
import type { MessageContext } from "@coffeesnob/supabase";

// What a bug report carries so nobody has to explain their phone. Shown to
// the sender under the note; nothing else is collected.
export function deviceContext(screen: string): MessageContext {
  const { width, height } = Dimensions.get("window");
  const agent = Platform.OS === "web" && typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : undefined;
  return {
    platform: Platform.OS === "web" ? "web" : `${Platform.OS} ${Platform.Version}`,
    version: Constants.expoConfig?.version ?? undefined,
    screen,
    viewport: `${Math.round(width)}×${Math.round(height)}`,
    ...(agent ? { agent } : {}),
  };
}

// The short line under a bug note: "Sends: web · app 1.0.0 · /map · 390×844".
export function contextLine(c: MessageContext): string {
  return ["Sends:", [c.platform, c.version && `app ${c.version}`, c.screen, c.viewport].filter(Boolean).join(" · ")].join(" ");
}
