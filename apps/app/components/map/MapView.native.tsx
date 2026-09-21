import { View } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { Body } from "../primitives";
import type { MapViewProps } from "./types";

// v1 ships as a web app only. The native app comes later and will need its
// own map implementation (Leaflet is web-only).
export function MapView(_props: MapViewProps) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.paper }}>
      <Body style={{ textAlign: "center", color: colors.ink3 }}>The map is web-only for now.</Body>
    </View>
  );
}
