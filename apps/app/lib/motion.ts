import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform } from "react-native";

// The app's motion vocabulary. Motion here only ever says something changed:
// a panel arrived, a toggle flipped. 150–250 ms, ease-out-quart, never bounce.
// With reduced motion on, everything lands in its final state at once.
export const EASE_OUT = Easing.bezier(0.25, 1, 0.5, 1);
const NATIVE = Platform.OS !== "web";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => live && setReduced(v), () => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

// A panel arriving (menu, preview card, results): fades in while rising `rise`
// px into place. Runs once, on mount — key the component to replay it.
export function useEnter(rise = 8, duration = 200) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      t.setValue(1);
      return;
    }
    Animated.timing(t, { toValue: 1, duration, easing: EASE_OUT, useNativeDriver: NATIVE }).start();
  }, [t, duration, reduced]);
  return { opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) }] };
}

// A toggle flipping on (like, save): a quick dip and return, so the tap reads
// as landed. Only on the way on; turning it off just changes the icon.
export function usePop(on: boolean) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!on || reduced) return;
    scale.setValue(0.7);
    Animated.timing(scale, { toValue: 1, duration: 220, easing: EASE_OUT, useNativeDriver: NATIVE }).start();
  }, [on, reduced, scale]);
  return { transform: [{ scale }] };
}
