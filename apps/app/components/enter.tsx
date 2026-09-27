import type { ReactNode } from "react";
import { Animated, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { useEnter } from "../lib/motion";

// Wraps something that arrives (a menu, the preview card, search results) in
// the app's one entrance: fade in while rising into place. Change the `key`
// to replay it for new content.
export function Enter({
  rise = 8,
  duration = 200,
  style,
  children,
  ...rest
}: Omit<ViewProps, "style"> & { rise?: number; duration?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const motion = useEnter(rise, duration);
  return (
    <Animated.View {...rest} style={[style, motion]}>
      {children}
    </Animated.View>
  );
}
