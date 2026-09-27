import { forwardRef } from "react";
import { Pressable, type PressableProps, type PressableStateCallbackType, type StyleProp, type View, type ViewStyle } from "react-native";

// How a Tap answers a press (and a hover, on web):
// - "fade": buttons, chips, icons — the thing itself dims.
// - "tint": list rows and menu items — the row's ground darkens a step.
// - "none": invisible backdrops that only exist to catch a tap.
export type TapFeedback = "fade" | "tint" | "none";

type TapState = PressableStateCallbackType & { hovered?: boolean };

// Web-only: the fade/tint eases instead of snapping (react-native-web passes
// these through as CSS; public/index.html zeroes them for reduced motion).
const EASE = { transitionProperty: "opacity, background-color", transitionDuration: "150ms", transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)" } as ViewStyle;

function feedbackStyle(feedback: TapFeedback, { pressed, hovered }: TapState, disabled: boolean): ViewStyle | null {
  if (disabled) return { opacity: 0.4 };
  if (feedback === "fade") return pressed ? { opacity: 0.6 } : hovered ? { opacity: 0.82 } : null;
  // Ink at low alpha, so the step reads the same on paper, card or cream.
  if (feedback === "tint") return pressed ? { backgroundColor: "rgba(22,19,16,.09)" } : hovered ? { backgroundColor: "rgba(22,19,16,.045)" } : null;
  return null;
}

// Every tappable thing in the app: Pressable's props, plus the states Pressable
// never shows on its own — pressed, hover, disabled. Keyboard focus is the
// global 2px burnt ring in public/index.html.
export type TapProps = Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle>; feedback?: TapFeedback };

export const Tap = forwardRef<View, TapProps>(function Tap(
  { style, feedback = "fade", disabled, ...rest },
  ref,
) {
  return <Pressable ref={ref} disabled={disabled} {...rest} style={(state) => [EASE, style, feedbackStyle(feedback, state, !!disabled)]} />;
});
